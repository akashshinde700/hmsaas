import paramiko
import time

HOST     = "72.60.206.56"
PORT     = 22
USER     = "drjaju"
PASSWORD = "Qweasdzx@8055"
REMOTE_DIR = "/home/drjaju/medwiki"
REMOTE_LOG = f"{REMOTE_DIR}/scraper.log"
PACKAGES   = "selenium webdriver-manager mysql-connector-python requests"


def safe_print(text):
    if isinstance(text, bytes):
        text = text.decode("utf-8", errors="replace")
    safe = text.encode("ascii", errors="replace").decode("ascii")
    print(safe, end="")


def connect_ssh():
    print(f"[CONNECT] {HOST}:{PORT} ...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=PORT, username=USER, password=PASSWORD,
                timeout=120, banner_timeout=120, auth_timeout=120)
    print("[OK] Connected.")
    return ssh


def run(ssh, command, timeout=300):
    print(f"\n[CMD] {command[:120]}")
    stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
    out = stdout.read()
    err = stderr.read()
    code = stdout.channel.recv_exit_status()
    if out:
        safe_print(out)
    if err:
        safe_print(err)
    return out.decode("utf-8", errors="replace"), err.decode("utf-8", errors="replace"), code


def main():
    ssh = connect_ssh()
    try:
        # Install with --break-system-packages (Ubuntu 23.04+ PEP 668)
        print("\n[STEP 1] Install packages with --break-system-packages")
        out, err, code = run(ssh,
            f"pip3 install --break-system-packages {PACKAGES} 2>&1 | tail -15",
            timeout=300)
        if code != 0:
            print(f"[WARN] pip3 returned {code}. Trying python3 -m pip ...")
            out, err, code = run(ssh,
                f"python3 -m pip install --break-system-packages {PACKAGES} 2>&1 | tail -15",
                timeout=300)

        # Verify
        print("\n[STEP 2] Verify imports")
        out, err, code = run(ssh,
            "python3 -c \"import selenium; import mysql.connector; import requests; print('ALL_OK')\"",
            timeout=15)
        if "ALL_OK" not in out:
            print("[ERROR] Still failing. Trying venv approach ...")
            # Create a venv and install there
            run(ssh, "python3 -m venv /home/drjaju/medwiki/venv 2>&1", timeout=60)
            run(ssh,
                f"/home/drjaju/medwiki/venv/bin/pip install {PACKAGES} 2>&1 | tail -10",
                timeout=300)
            # Patch shebang to use venv python
            run(ssh,
                "sed -i '1s|^#!/.*|#!/home/drjaju/medwiki/venv/bin/python3|' "
                "/home/drjaju/medwiki/ready.py || true", timeout=10)
            # Test venv
            out, err, code = run(ssh,
                "/home/drjaju/medwiki/venv/bin/python3 -c "
                "\"import selenium; import mysql.connector; print('VENV_OK')\"",
                timeout=15)
            if "VENV_OK" not in out:
                print("[ERROR] venv also failed!")
                return
            print("[OK] Packages installed in venv.")
            # Update start command to use venv
            start_python = "/home/drjaju/medwiki/venv/bin/python3"
        else:
            print("[OK] All imports work in system Python.")
            start_python = "python3"

        # Kill old + start fresh
        print("\n[STEP 3] Kill old scraper + start fresh")
        run(ssh, "pkill -f 'python3.*ready.py' 2>/dev/null || true", timeout=10)
        run(ssh, f"rm -f {REMOTE_DIR}/scraper.lock", timeout=10)
        time.sleep(2)

        start_cmd = (
            f"cd {REMOTE_DIR} && "
            f"nohup {start_python} -u ready.py > {REMOTE_LOG} 2>&1 &"
        )
        run(ssh, start_cmd, timeout=15)
        print("[OK] Scraper started.")

        time.sleep(12)

        print("\n[LOGS] First 50 lines of scraper.log:")
        run(ssh, f"head -50 {REMOTE_LOG} 2>/dev/null || echo 'No log yet'", timeout=15)

        out, _, _ = run(ssh,
            "pgrep -f 'python3.*ready.py' && echo RUNNING || echo NOT_RUNNING",
            timeout=10)
        if "RUNNING" in out:
            print(f"\n[OK] Scraper running. Monitor: ssh drjaju@{HOST} 'tail -f {REMOTE_LOG}'")
        else:
            print("\n[WARN] Process not detected. Full log:")
            run(ssh, f"cat {REMOTE_LOG}", timeout=15)

        # Also update cron to use correct python if venv
        if start_python != "python3":
            print("\n[STEP 4] Update cron to use venv python")
            cron_job = (
                f"0 2 1 * * "
                f"cd {REMOTE_DIR} && "
                f"{start_python} -u {REMOTE_DIR}/ready.py >> {REMOTE_DIR}/scraper_monthly.log 2>&1"
            )
            add_cron_cmd = (
                f"(crontab -l 2>/dev/null | grep -v 'medwiki\\|ready.py'; "
                f"echo '{cron_job}') | crontab -"
            )
            run(ssh, add_cron_cmd, timeout=15)
            print(f"[OK] Cron updated to use {start_python}")

    finally:
        ssh.close()
        print("\n[INFO] Done.")


if __name__ == "__main__":
    main()
