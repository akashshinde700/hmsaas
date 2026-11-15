import os
import sys
import socket
import time
import paramiko

os.environ["PYTHONIOENCODING"] = "utf-8"

HOST     = "72.60.206.56"
PORT     = 22
USER     = "drjaju"
PASSWORD = "Qweasdzx@8055"

LOCAL_ROOT   = r"c:\Users\ACER\Desktop\medwiki"
LOCAL_SCRIPT = os.path.join(LOCAL_ROOT, "ready.py")
LOCAL_SQL    = os.path.join(LOCAL_ROOT, "medicines_import.sql")

REMOTE_DIR    = "/home/drjaju/medwiki"
REMOTE_SCRIPT = f"{REMOTE_DIR}/ready.py"
REMOTE_SQL    = f"{REMOTE_DIR}/medicines_import.sql"
REMOTE_LOG    = f"{REMOTE_DIR}/scraper.log"

DB_USER     = "drjaju"
DB_PASSWORD = "Qweasdzx@8055"
DB_NAME     = "medicines"


def safe_print(text):
    if isinstance(text, bytes):
        text = text.decode("utf-8", errors="replace")
    safe = text.encode("ascii", errors="replace").decode("ascii")
    print(safe, end="")


def check_ssh_reachable(host, port=22, timeout=30):
    try:
        sock = socket.create_connection((host, port), timeout=timeout)
        sock.close()
        return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


def connect_ssh(retries=5, delay=15):
    for attempt in range(1, retries + 1):
        print(f"\n[CONNECT] Attempt {attempt}/{retries} — {HOST}:{PORT} ...")
        if not check_ssh_reachable(HOST, PORT, timeout=30):
            print(f"[WARN] Port {PORT} not reachable.")
            if attempt < retries:
                print(f"[WAIT] Retrying in {delay}s ...")
                time.sleep(delay)
            continue
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(HOST, port=PORT, username=USER, password=PASSWORD,
                        timeout=120, banner_timeout=120, auth_timeout=120)
            print("[OK] Connected.")
            return ssh
        except Exception as e:
            print(f"[ERROR] SSH failed: {e}")
            if attempt < retries:
                print(f"[WAIT] Retrying in {delay}s ...")
                time.sleep(delay)
    return None


def run(ssh, command, timeout=300):
    print(f"\n[CMD] {command}")
    stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
    out = stdout.read()
    err = stderr.read()
    code = stdout.channel.recv_exit_status()
    safe_print(out)
    if err:
        safe_print(err)
    return out.decode("utf-8", errors="replace"), err.decode("utf-8", errors="replace"), code


def ensure_remote_dir(sftp, remote_dir):
    parts = remote_dir.strip("/").split("/")
    cur = ""
    for p in parts:
        cur += "/" + p
        try:
            sftp.stat(cur)
        except FileNotFoundError:
            sftp.mkdir(cur)


def patch_ready_for_linux(local_path):
    """Read ready.py and patch it for Linux headless server."""
    with open(local_path, "r", encoding="utf-8") as f:
        code = f.read()

    # 1. Fix DB_CONFIG credentials
    code = code.replace(
        "'user':     'root',\n    'password': 'root',",
        f"'user':     '{DB_USER}',\n    'password': '{DB_PASSWORD}',",
    )
    code = code.replace(
        "'user': 'root',\n    'password': 'root',",
        f"'user': '{DB_USER}',\n    'password': '{DB_PASSWORD}',",
    )

    # 2. Add --headless flag for server
    if "'--headless'" not in code:
        code = code.replace(
            "options = Options()\n            options.add_argument('--start-maximized')",
            "options = Options()\n            options.add_argument('--headless')\n            options.add_argument('--start-maximized')",
        )

    return code


def main():
    print("=" * 60)
    print("Medwiki Scraper — Deploy to Live Server")
    print("=" * 60)

    # Pre-check
    print(f"\n[PRE-CHECK] Testing SSH to {HOST}:{PORT} ...")
    if not check_ssh_reachable(HOST, PORT, timeout=10):
        print("[ERROR] Server not reachable.")
        sys.exit(1)
    print("[OK] Reachable.")

    # Patch ready.py in memory
    print("\n[PATCH] Patching ready.py for Linux headless ...")
    if not os.path.exists(LOCAL_SCRIPT):
        print(f"[ERROR] ready.py not found: {LOCAL_SCRIPT}")
        sys.exit(1)
    patched_code = patch_ready_for_linux(LOCAL_SCRIPT)
    print("[OK] Patched (headless=True, DB user=drjaju).")

    # Connect SSH
    ssh = connect_ssh(retries=3, delay=10)
    if ssh is None:
        print("[ERROR] SSH failed after 3 attempts.")
        sys.exit(1)

    try:
        sftp = ssh.open_sftp()

        # Step 1: Create remote directory
        print("\n" + "=" * 60)
        print("[STEP 1] Creating /home/drjaju/medwiki")
        print("=" * 60)
        ensure_remote_dir(sftp, REMOTE_DIR)
        print("[OK] Directory ready.")

        # Step 2: Create medicines database
        print("\n" + "=" * 60)
        print("[STEP 2] Creating medicines database on MySQL")
        print("=" * 60)
        create_db_cmd = (
            f"mysql -u {DB_USER} -p'{DB_PASSWORD}' -e "
            f"\"CREATE DATABASE IF NOT EXISTS {DB_NAME} "
            f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\""
        )
        out, err, code = run(ssh, create_db_cmd, timeout=30)
        if code != 0:
            print(f"[ERROR] DB creation failed (code {code}).")
            print("[TRY] Attempting with root user ...")
            run(ssh, f"mysql -u root -p'{DB_PASSWORD}' -e \"CREATE DATABASE IF NOT EXISTS {DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL ON {DB_NAME}.* TO '{DB_USER}'@'localhost'; FLUSH PRIVILEGES;\"", timeout=30)
        else:
            print(f"[OK] Database '{DB_NAME}' ready.")

        # Step 3: Upload medicines_import.sql and run schema
        print("\n" + "=" * 60)
        print("[STEP 3] Uploading schema SQL and creating table")
        print("=" * 60)
        sftp.put(LOCAL_SQL, REMOTE_SQL)
        print(f"  uploaded: {REMOTE_SQL}")

        # Run SQL (skip USE statement since we pass -D flag)
        run_sql_cmd = (
            f"mysql -u {DB_USER} -p'{DB_PASSWORD}' {DB_NAME} < {REMOTE_SQL}"
        )
        out, err, code = run(ssh, run_sql_cmd, timeout=60)
        if code != 0 and "already exists" not in err.lower():
            print(f"[WARN] SQL import code={code} — may be ok if table already exists")
        else:
            print("[OK] medicines table created/verified.")

        # Step 4: Upload patched ready.py
        print("\n" + "=" * 60)
        print("[STEP 4] Uploading patched ready.py")
        print("=" * 60)
        patched_bytes = patched_code.encode("utf-8")
        import io
        fl = sftp.open(REMOTE_SCRIPT, "wb")
        fl.write(patched_bytes)
        fl.close()
        print(f"  uploaded: {REMOTE_SCRIPT}")

        # Verify patch
        out, _, _ = run(ssh, f"grep -n 'headless\\|drjaju' {REMOTE_SCRIPT} | head -10", timeout=10)
        print("[OK] Patch verified.")

        # Step 5: Install Python dependencies
        print("\n" + "=" * 60)
        print("[STEP 5] Installing Python dependencies")
        print("=" * 60)
        run(ssh, "pip3 install --quiet selenium webdriver-manager mysql-connector-python requests 2>&1 | tail -5", timeout=300)
        print("[OK] Python deps installed.")

        # Step 6: Install Chromium
        print("\n" + "=" * 60)
        print("[STEP 6] Checking/Installing Chromium")
        print("=" * 60)
        out, _, _ = run(ssh, "which chromium-browser || which chromium || which google-chrome || echo NOT_FOUND", timeout=10)
        if "NOT_FOUND" in out:
            print("[INFO] Chrome not found. Installing chromium ...")
            run(ssh, "sudo apt-get update -qq && sudo apt-get install -y chromium-browser 2>&1 | tail -5", timeout=300)
            # If apt fails, try snap
            run(ssh, "which chromium-browser || sudo snap install chromium 2>&1 | tail -3 || true", timeout=120)
        else:
            print(f"[OK] Chrome found: {out.strip()}")

        # Step 7: Set up monthly cron (1st of every month at 02:00 AM)
        print("\n" + "=" * 60)
        print("[STEP 7] Setting up monthly cron (1st of month, 02:00 AM)")
        print("=" * 60)
        monthly_log = f"{REMOTE_DIR}/scraper_monthly.log"
        cron_job = (
            f"0 2 1 * * "
            f"cd {REMOTE_DIR} && "
            f"python3 -u {REMOTE_SCRIPT} >> {monthly_log} 2>&1"
        )
        # Add cron entry — remove old medwiki cron first, then add fresh
        add_cron_cmd = (
            f"(crontab -l 2>/dev/null | grep -v 'medwiki\\|ready.py'; "
            f"echo '{cron_job}') | crontab -"
        )
        run(ssh, add_cron_cmd, timeout=15)
        # Verify
        out, _, _ = run(ssh, "crontab -l 2>/dev/null | grep 'ready.py' || echo NOT_SET", timeout=10)
        if "ready.py" in out:
            print("[OK] Monthly cron set:")
            print(f"  {cron_job}")
        else:
            print("[WARN] Cron may not be set. Check manually: crontab -e")

        # Step 8: Kill any existing scraper + start initial run now
        print("\n" + "=" * 60)
        print("[STEP 8] Starting initial scrape run (nohup background)")
        print("=" * 60)
        # Remove stale lock file if any
        run(ssh, f"rm -f {REMOTE_DIR}/scraper.lock", timeout=10)
        run(ssh, f"pkill -f 'python3.*ready.py' 2>/dev/null || true", timeout=10)
        time.sleep(2)

        start_cmd = (
            f"cd {REMOTE_DIR} && "
            f"nohup python3 -u {REMOTE_SCRIPT} > {REMOTE_LOG} 2>&1 &"
        )
        run(ssh, start_cmd, timeout=15)
        print("[OK] Scraper started.")

        # Wait and show initial logs
        time.sleep(8)
        print("\n[LOGS] First 30 lines of scraper.log:")
        run(ssh, f"head -30 {REMOTE_LOG} 2>/dev/null || echo 'Log not yet available'", timeout=15)

        # Check if process is running
        out, _, _ = run(ssh, f"pgrep -f 'python3.*ready.py' && echo RUNNING || echo NOT_RUNNING", timeout=10)
        if "RUNNING" in out:
            print("\n[OK] Scraper is running in background.")
        else:
            print("\n[WARN] Scraper process not detected. Check logs:")
            run(ssh, f"tail -20 {REMOTE_LOG} 2>/dev/null", timeout=10)

        print("\n" + "=" * 60)
        print("[SUCCESS] Medwiki deploy complete.")
        print(f"  DB         : {DB_NAME} on {HOST}")
        print(f"  Script     : {REMOTE_SCRIPT}")
        print(f"  Live log   : {REMOTE_LOG}")
        print(f"  Monthly log: {monthly_log}")
        print(f"  Cron       : 1st of every month at 02:00 AM")
        print(f"  Monitor    : ssh drjaju@{HOST} 'tail -f {REMOTE_LOG}'")
        print("=" * 60)

    finally:
        try:
            sftp.close()
        except Exception:
            pass
        ssh.close()
        print("\n[INFO] SSH closed.")


if __name__ == "__main__":
    main()
