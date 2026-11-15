import paramiko
import time

HOST     = "72.60.206.56"
PORT     = 22
USER     = "drjaju"
PASSWORD = "Qweasdzx@8055"
REMOTE_DIR = "/home/drjaju/medwiki"
REMOTE_LOG = f"{REMOTE_DIR}/scraper.log"


def safe_print(text):
    if isinstance(text, bytes):
        text = text.decode("utf-8", errors="replace")
    safe = text.encode("ascii", errors="replace").decode("ascii")
    print(safe, end="")


def run(ssh, command, timeout=30):
    print(f"\n[CMD] {command}")
    stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
    out = stdout.read()
    err = stderr.read()
    code = stdout.channel.recv_exit_status()
    if out: safe_print(out)
    if err: safe_print(err)
    return out.decode("utf-8", errors="replace"), err.decode("utf-8", errors="replace"), code


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
    print("[OK] Connected")

    # Check if scraper is running
    out, _, _ = run(ssh, "pgrep -f 'python3.*ready.py' && echo RUNNING || echo NOT_RUNNING")
    if "NOT_RUNNING" in out:
        print("\n[INFO] Scraper not running. Starting now ...")
        # Use exec_command with nohup in a way that doesn't block
        ssh.exec_command(
            f"cd {REMOTE_DIR} && nohup python3 -u ready.py > {REMOTE_LOG} 2>&1 &",
            timeout=5
        )
        time.sleep(5)
        run(ssh, "pgrep -f 'python3.*ready.py' && echo RUNNING || echo NOT_RUNNING")

    # Show logs
    print("\n[LOGS] Last 60 lines of scraper.log:")
    run(ssh, f"tail -60 {REMOTE_LOG} 2>/dev/null || echo 'No log yet'", timeout=20)

    # Show DB row count
    print("\n[DB] Row count in medicine.medicines:")
    run(ssh,
        "mysql -u sky -p'Qweasdzx@8055' -h 127.0.0.1 medicine "
        "-e 'SELECT COUNT(*) as total_rows FROM medicines;' 2>/dev/null",
        timeout=15)

    ssh.close()


if __name__ == "__main__":
    main()
