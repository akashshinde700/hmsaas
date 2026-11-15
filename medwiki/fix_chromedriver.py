import paramiko
import time

HOST     = "72.60.206.56"
PORT     = 22
USER     = "drjaju"
PASSWORD = "Qweasdzx@8055"
REMOTE_DIR  = "/home/drjaju/medwiki"
REMOTE_SCRIPT = f"{REMOTE_DIR}/ready.py"
REMOTE_LOG  = f"{REMOTE_DIR}/scraper.log"


def safe_print(text):
    if isinstance(text, bytes):
        text = text.decode("utf-8", errors="replace")
    safe = text.encode("ascii", errors="replace").decode("ascii")
    print(safe, end="")


def run(ssh, command, timeout=120):
    print(f"\n[CMD] {command[:120]}")
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

    # Step 1: Check versions
    print("\n[STEP 1] Check Chromium + chromedriver versions")
    run(ssh, "chromium-browser --version 2>/dev/null || chromium --version 2>/dev/null || echo 'NOT_FOUND'")
    run(ssh, "which chromedriver 2>/dev/null && chromedriver --version 2>/dev/null || echo 'NO_CHROMEDRIVER'")

    # Step 2: Install chromium-driver (matching version)
    print("\n[STEP 2] Install chromium-driver (matches installed chromium version)")
    out, err, code = run(ssh,
        f"echo '{PASSWORD}' | sudo -S apt-get install -y chromium-driver 2>&1 | tail -10",
        timeout=300)

    # Verify
    run(ssh, "which chromedriver && chromedriver --version")

    # Step 3: Kill old scrapers
    print("\n[STEP 3] Kill all old scraper processes")
    run(ssh, "pkill -f 'python3.*ready.py' 2>/dev/null || true")
    run(ssh, f"rm -f {REMOTE_DIR}/scraper.lock")
    time.sleep(2)

    # Step 4: Patch setup_driver in remote ready.py to use system chromedriver
    print("\n[STEP 4] Patch setup_driver to use system chromedriver at /usr/bin/chromedriver")

    # Read current remote ready.py
    sftp = ssh.open_sftp()
    with sftp.open(REMOTE_SCRIPT, 'r') as f:
        code_text = f.read().decode('utf-8')

    # Replace setup_driver function to use system chromedriver
    old_setup = '''def setup_driver():
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--start-maximized')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1920,1080')
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=options)'''

    new_setup = '''def setup_driver():
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1920,1080')
    options.add_argument('--disable-extensions')
    options.add_argument('--disable-software-rasterizer')
    # Use system chromedriver that matches installed chromium version
    for cd_path in ['/usr/bin/chromedriver', '/usr/lib/chromium-browser/chromedriver',
                    '/snap/bin/chromedriver']:
        import os
        if os.path.exists(cd_path):
            service = Service(cd_path)
            break
    else:
        service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=options)'''

    if old_setup in code_text:
        code_text = code_text.replace(old_setup, new_setup)
        print("[OK] Found and replaced old setup_driver.")
    else:
        # Try partial match — find and replace any setup_driver that uses ChromeDriverManager
        import re
        # Replace just the service line
        code_text = re.sub(
            r"service = Service\(ChromeDriverManager\(\)\.install\(\)\)",
            (
                "service = Service('/usr/bin/chromedriver') "
                "if __import__('os').path.exists('/usr/bin/chromedriver') "
                "else Service(ChromeDriverManager().install())"
            ),
            code_text
        )
        print("[OK] Patched ChromeDriverManager line via regex.")

    # Also set binary location to chromium-browser
    if "binary_location" not in code_text:
        code_text = code_text.replace(
            "options.add_argument('--disable-software-rasterizer')",
            "options.add_argument('--disable-software-rasterizer')\n"
            "    for cb in ['/usr/bin/chromium-browser', '/usr/bin/chromium']:\n"
            "        if __import__('os').path.exists(cb):\n"
            "            options.binary_location = cb\n"
            "            break"
        )

    # Write back
    with sftp.open(REMOTE_SCRIPT, 'w') as f:
        f.write(code_text.encode('utf-8'))
    sftp.close()
    print("[OK] Patched ready.py uploaded.")

    # Verify patch
    run(ssh, f"grep -n 'chromedriver\\|binary_location\\|ChromeDriverManager' {REMOTE_SCRIPT} | head -15")

    # Step 5: Start scraper
    print("\n[STEP 5] Start scraper")
    ssh.exec_command(
        f"cd {REMOTE_DIR} && nohup python3 -u ready.py > {REMOTE_LOG} 2>&1 &"
    )
    time.sleep(15)

    print("\n[LOGS] First 60 lines:")
    run(ssh, f"head -60 {REMOTE_LOG} 2>/dev/null || echo 'No log yet'", timeout=20)

    out, _, _ = run(ssh, "pgrep -f 'python3.*ready.py' && echo RUNNING || echo NOT_RUNNING")
    if "RUNNING" in out:
        print(f"\n[OK] Scraper running. Monitor: ssh drjaju@{HOST} 'tail -f {REMOTE_LOG}'")
    else:
        print("\n[WARN] Not running. Check full log:")
        run(ssh, f"cat {REMOTE_LOG}", timeout=20)

    ssh.close()
    print("\n[INFO] Done.")


if __name__ == "__main__":
    main()
