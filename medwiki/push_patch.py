"""Push patched ready.py to server and restart scraper."""
import paramiko
import time
import io
import re

HOST     = "72.60.206.56"
PORT     = 22
USER     = "drjaju"
PASSWORD = "Qweasdzx@8055"
LOCAL_SCRIPT  = r"c:\Users\ACER\Desktop\medwiki\ready.py"
REMOTE_DIR    = "/home/drjaju/medwiki"
REMOTE_SCRIPT = f"{REMOTE_DIR}/ready.py"
REMOTE_LOG    = f"{REMOTE_DIR}/scraper.log"

DB_USER = "sky"
DB_PASS = "Qweasdzx@8055"
DB_NAME = "medicine"


def patch_for_linux(code):
    # DB credentials
    code = re.sub(
        r"'host':\s*'[^']*'",
        "'host':     '127.0.0.1'",
        code
    )
    code = re.sub(
        r"'user':\s*'[^']*'",
        f"'user':     '{DB_USER}'",
        code
    )
    code = re.sub(
        r"'password':\s*'[^']*'",
        f"'password': '{DB_PASS}'",
        code
    )
    code = re.sub(
        r"'database':\s*'[^']*'",
        f"'database': '{DB_NAME}'",
        code
    )
    # Add headless if not present
    if "'--headless'" not in code:
        code = code.replace(
            "options.add_argument('--no-sandbox')",
            "options.add_argument('--headless')\n            options.add_argument('--no-sandbox')"
        )
    # Use system chromedriver
    code = re.sub(
        r"service = Service\(ChromeDriverManager\(\)\.install\(\)\)",
        (
            "service = Service('/usr/bin/chromedriver') "
            "if __import__('os').path.exists('/usr/bin/chromedriver') "
            "else Service(ChromeDriverManager().install())"
        ),
        code
    )
    return code


def safe_print(text):
    if isinstance(text, bytes):
        text = text.decode("utf-8", errors="replace")
    safe = text.encode("ascii", errors="replace").decode("ascii")
    print(safe, end="")


def run(ssh, command, timeout=30):
    print(f"\n[CMD] {command[:120]}")
    _, stdout, stderr = ssh.exec_command(command, timeout=timeout)
    out = stdout.read()
    err = stderr.read()
    stdout.channel.recv_exit_status()
    if out: safe_print(out)
    if err: safe_print(err)
    return out.decode("utf-8", errors="replace")


def main():
    # Read + patch local ready.py
    with open(LOCAL_SCRIPT, 'r', encoding='utf-8') as f:
        code = f.read()
    patched = patch_for_linux(code)
    print("[OK] Patched locally.")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
    print("[OK] Connected.")

    # Kill old scraper + clear lock + checkpoint
    print("\n[1] Kill old scraper")
    run(ssh, "pkill -f 'python3.*ready.py' 2>/dev/null || true")
    run(ssh, f"rm -f {REMOTE_DIR}/scraper.lock {REMOTE_DIR}/scraper_checkpoint.json")
    time.sleep(2)

    # Delete wrong records from DB (form mismatch)
    print("\n[2] Clean bad records from DB")
    run(ssh,
        f"mysql -u {DB_USER} -p'{DB_PASS}' -h 127.0.0.1 {DB_NAME} "
        "-e \"DELETE FROM medicines WHERE (dosage_form='Capsule' OR dosage_form='Powder' OR dosage_form='Eye Drop') "
        "AND generic_name LIKE '%Injectable%';\" 2>/dev/null",
        timeout=15)
    run(ssh,
        f"mysql -u {DB_USER} -p'{DB_PASS}' -h 127.0.0.1 {DB_NAME} "
        "-e 'SELECT COUNT(*) remaining FROM medicines;' 2>/dev/null",
        timeout=10)

    # Upload patched ready.py
    print("\n[3] Upload patched ready.py")
    sftp = ssh.open_sftp()
    with sftp.open(REMOTE_SCRIPT, 'wb') as f:
        f.write(patched.encode('utf-8'))
    sftp.close()
    print("[OK] Uploaded.")

    # Verify patch
    run(ssh, f"grep -n 'url_slug\\|chromedriver\\|headless\\|sky\\|medicine' {REMOTE_SCRIPT} | head -15")

    # Start scraper
    print("\n[4] Start scraper")
    ssh.exec_command(f"cd {REMOTE_DIR} && nohup python3 -u ready.py > {REMOTE_LOG} 2>&1 &")
    time.sleep(15)

    print("\n[5] Log tail:")
    run(ssh, f"head -30 {REMOTE_LOG} 2>/dev/null || echo 'No log'", timeout=20)

    out = run(ssh, "pgrep -f 'python3.*ready.py' && echo RUNNING || echo NOT_RUNNING")
    if "RUNNING" in out:
        print(f"\n[OK] Scraper running. Monitor: ssh drjaju@{HOST} 'tail -f {REMOTE_LOG}'")
    else:
        print("\n[WARN] Not running. Full log:")
        run(ssh, f"cat {REMOTE_LOG}", timeout=20)

    ssh.close()
    print("\n[INFO] Done.")


if __name__ == "__main__":
    main()
