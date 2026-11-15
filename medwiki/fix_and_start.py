import paramiko
import time
import socket

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


def connect_ssh():
    print(f"[CONNECT] {HOST}:{PORT} ...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=PORT, username=USER, password=PASSWORD,
                timeout=120, banner_timeout=120, auth_timeout=120)
    print("[OK] Connected.")
    return ssh


def run(ssh, command, timeout=300):
    print(f"\n[CMD] {command[:100]}")
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
        # Step 1: Install python3-pip via sudo
        print("\n" + "=" * 60)
        print("[STEP 1] Installing python3-pip via sudo apt-get")
        print("=" * 60)
        out, err, code = run(ssh,
            f"echo '{PASSWORD}' | sudo -S apt-get install -y python3-pip 2>&1 | tail -10",
            timeout=300)
        if code != 0:
            print(f"[WARN] apt-get returned {code}, trying ensurepip...")
            run(ssh, f"python3 -m ensurepip --upgrade 2>&1 || true", timeout=60)

        # Step 2: Verify pip available
        print("\n" + "=" * 60)
        print("[STEP 2] Verify pip")
        print("=" * 60)
        out, err, code = run(ssh, "pip3 --version || python3 -m pip --version || echo 'PIP_NOT_FOUND'", timeout=15)
        if "PIP_NOT_FOUND" in out:
            print("[WARN] pip still not found. Trying get-pip.py ...")
            run(ssh, "curl -sS https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py && python3 /tmp/get-pip.py --user 2>&1 | tail -5", timeout=120)
            run(ssh, "echo 'export PATH=$PATH:$HOME/.local/bin' >> ~/.bashrc && export PATH=$PATH:$HOME/.local/bin", timeout=10)

        # Step 3: Install Python packages
        print("\n" + "=" * 60)
        print("[STEP 3] Installing selenium, webdriver-manager, mysql-connector-python, requests")
        print("=" * 60)
        # Try pip3, fall back to python3 -m pip, fall back to --user installs
        cmds = [
            "pip3 install --quiet selenium webdriver-manager mysql-connector-python requests 2>&1 | tail -10",
            "python3 -m pip install --quiet selenium webdriver-manager mysql-connector-python requests 2>&1 | tail -10",
            "pip3 install --user --quiet selenium webdriver-manager mysql-connector-python requests 2>&1 | tail -10",
            "python3 -m pip install --user --quiet selenium webdriver-manager mysql-connector-python requests 2>&1 | tail -10",
        ]
        installed = False
        for cmd in cmds:
            out, err, code = run(ssh, cmd, timeout=300)
            if code == 0:
                print("[OK] Packages installed.")
                installed = True
                break
            print(f"[WARN] Failed (code {code}), trying next method...")

        if not installed:
            print("[ERROR] Could not install packages via any pip method!")
            # Try pip install with sudo as last resort
            run(ssh,
                f"echo '{PASSWORD}' | sudo -S pip3 install selenium webdriver-manager mysql-connector-python requests 2>&1 | tail -10",
                timeout=300)

        # Step 4: Verify imports
        print("\n" + "=" * 60)
        print("[STEP 4] Verify Python imports")
        print("=" * 60)
        verify_cmd = "python3 -c \"import selenium; import mysql.connector; import requests; print('ALL_OK')\""
        out, err, code = run(ssh, verify_cmd, timeout=15)
        if "ALL_OK" not in out:
            print("[ERROR] Import check failed!")
            print("Trying with PYTHONPATH including .local/lib ...")
            run(ssh,
                "PYTHONPATH=$(python3 -c \"import sys; print(':'.join(sys.path))\"):$HOME/.local/lib/python3.12/site-packages "
                + verify_cmd, timeout=15)
        else:
            print("[OK] All imports verified.")

        # Step 5: Kill old scraper + remove lock
        print("\n" + "=" * 60)
        print("[STEP 5] Kill old scraper and clear lock")
        print("=" * 60)
        run(ssh, f"pkill -f 'python3.*ready.py' 2>/dev/null || true", timeout=10)
        run(ssh, f"rm -f {REMOTE_DIR}/scraper.lock", timeout=10)
        time.sleep(2)

        # Step 6: Start scraper
        print("\n" + "=" * 60)
        print("[STEP 6] Starting scraper")
        print("=" * 60)
        start_cmd = (
            f"cd {REMOTE_DIR} && "
            f"nohup python3 -u ready.py > {REMOTE_LOG} 2>&1 &"
        )
        run(ssh, start_cmd, timeout=15)
        print("[OK] Scraper started.")

        time.sleep(10)

        # Step 7: Show logs
        print("\n[LOGS] First 40 lines of scraper.log:")
        run(ssh, f"head -40 {REMOTE_LOG} 2>/dev/null || echo 'Log not yet available'", timeout=15)

        # Step 8: Check if running
        out, _, _ = run(ssh, "pgrep -f 'python3.*ready.py' && echo RUNNING || echo NOT_RUNNING", timeout=10)
        if "RUNNING" in out:
            print("\n[OK] Scraper is running.")
            print(f"  Monitor: ssh drjaju@{HOST} 'tail -f {REMOTE_LOG}'")
        else:
            print("\n[WARN] Scraper not detected. Full log:")
            run(ssh, f"cat {REMOTE_LOG} 2>/dev/null || echo 'No log'", timeout=15)

    finally:
        ssh.close()
        print("\n[INFO] SSH closed.")


if __name__ == "__main__":
    main()
