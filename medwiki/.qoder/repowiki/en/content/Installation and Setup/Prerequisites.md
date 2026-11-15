# Prerequisites

<cite>
**Referenced Files in This Document**
- [ready.py](file://ready.py)
- [medicines_import.sql](file://medicines_import.sql)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [System Requirements](#system-requirements)
3. [Software Prerequisites](#software-prerequisites)
4. [Database Setup](#database-setup)
5. [Verification Steps](#verification-steps)
6. [Common Issues and Solutions](#common-issues-and-solutions)
7. [Installation Instructions](#installation-instructions)

## Introduction
This document provides comprehensive prerequisites documentation for installing and running the MedWiki scraper. The scraper automates the collection of medicine information from medwiki.co.in and stores it directly into a MySQL database. Understanding the system requirements and proper configuration of prerequisites is essential for successful operation.

## System Requirements

### Operating Systems
The MedWiki scraper is designed to work across multiple operating systems:

- **Windows**: Tested on Windows 10 and later versions
- **Linux**: Compatible with major distributions (Ubuntu, CentOS, Fedora, etc.)
- **macOS**: Supported on recent macOS versions

### Hardware Requirements
While the scraper can run on modest hardware, the following minimum specifications are recommended:

- **RAM**: Minimum 4 GB RAM (8 GB recommended for optimal performance)
- **Disk Space**: Minimum 500 MB free space (additional space needed for downloaded Chrome drivers and temporary files)
- **CPU**: Single-core processor sufficient for basic operation

### Network Requirements
- **Internet Connectivity**: Stable, continuous connection required throughout the scraping process
- **Bandwidth**: Minimum 1 Mbps recommended (higher speeds improve performance)
- **Proxy Considerations**: The scraper does not include built-in proxy support; network restrictions may affect access to external APIs

## Software Prerequisites

### Python Environment
The scraper requires Python 3.x with specific package dependencies:

#### Required Python Packages
- **Selenium**: Web automation framework for browser control
- **mysql-connector-python**: MySQL database connector
- **webdriver-manager**: Automatic ChromeDriver management
- **requests**: HTTP library for Google search fallback
- **Additional standard libraries**: logging, datetime, urllib.parse, etc.

#### Version Compatibility Notes
- **Python 3.x**: Compatible with Python 3.7 and later versions
- **Selenium**: Latest stable version recommended
- **MySQL Connector**: Latest stable version compatible with Python 3.x

### Browser Requirements
The scraper uses Chrome/Chromium for web automation:

#### Chrome Browser
- **Installation**: Chrome browser must be installed on the system
- **Version**: Modern Chrome version recommended (tested with Chrome 120+)
- **Configuration**: No special configuration required beyond standard Chrome settings

#### ChromeDriver Management
- **Automatic Management**: The scraper uses webdriver-manager for automatic ChromeDriver installation
- **Supported Platforms**: Works on Windows, Linux, and macOS
- **Version Matching**: Automatically downloads compatible ChromeDriver version

### Database Requirements
The scraper requires MySQL server with specific configuration:

#### MySQL Server
- **Server Type**: MySQL Community Server or MariaDB
- **Version**: MySQL 5.7+ or MariaDB 10.2+ recommended
- **Authentication**: Root user access required
- **Character Set**: UTF-8 multibyte (utf8mb4) support required

#### Database Schema
The scraper creates and manages its own database schema automatically, but requires:
- **Database Name**: `medicines` (configurable in code)
- **Permissions**: CREATE, ALTER, INSERT, SELECT privileges
- **Storage Engine**: InnoDB recommended

## Database Setup

### Initial Database Preparation
The scraper can automatically create the required database structure, but manual preparation is also possible:

#### Automatic Setup
The scraper includes automatic database table creation with the following schema:
- **Table Name**: `medicines`
- **Primary Key**: Auto-incrementing integer ID
- **Indexing**: Comprehensive indexing for performance optimization
- **Full-text Search**: Enabled for efficient medicine name searches

#### Manual Setup Option
For advanced users, the database schema can be prepared manually using the provided SQL script:
- **File**: `medicines_import.sql`
- **Usage**: `mysql -u root -proot medicines < medicines_import.sql`
- **Features**: Complete table structure with all indexes and constraints

### Database Configuration
The scraper uses the following default configuration:
- **Host**: localhost
- **User**: root
- **Database**: medicines
- **Charset**: utf8mb4
- **Connection Timeout**: 60 seconds

## Verification Steps

### Python Environment Verification
To verify Python installation and dependencies:

1. **Python Version Check**
   ```bash
   python --version
   # Should display Python 3.x version
   ```

2. **Package Installation Verification**
   ```bash
   pip list | grep -E "(selenium|mysql-connector|webdriver-manager)"
   # Should show all required packages
   ```

3. **Import Test**
   ```python
   python -c "import selenium, mysql.connector, webdriver_manager; print('All packages imported successfully')"
   ```

### Browser Verification
To verify Chrome and ChromeDriver:

1. **Chrome Installation Check**
   ```bash
   google-chrome --version
   # Should display Chrome version
   ```

2. **ChromeDriver Test**
   ```python
   python -c "from selenium import webdriver; from selenium.webdriver.chrome.service import Service; from webdriver_manager.chrome import ChromeDriverManager; print('ChromeDriver manager working')"
   ```

### Database Verification
To verify MySQL connectivity:

1. **MySQL Connection Test**
   ```bash
   mysql -u root -e "SHOW DATABASES;"
   # Should list available databases
   ```

2. **Database Creation Test**
   ```bash
   mysql -u root -e "CREATE DATABASE IF NOT EXISTS medicines;"
   # Should execute without errors
   ```

### Scraper Validation
To validate the complete setup:

1. **Basic Execution Test**
   ```bash
   python ready.py
   # Should start the scraping process and log initial messages
   ```

2. **Log File Check**
   ```bash
   tail -f medwiki_YYYYMMDD.log
   # Should show progress logs and database connection messages
   ```

## Common Issues and Solutions

### Python Path Configuration Issues
**Problem**: Python cannot find required modules or packages
**Solutions**:
- Verify Python installation path is in system PATH
- Use virtual environment for package isolation
- Install missing packages using pip: `pip install selenium mysql-connector-python webdriver-manager`
- Check Python version compatibility (3.7+ required)

### Chrome Version Compatibility Problems
**Problem**: ChromeDriver version mismatch causing browser startup failures
**Solutions**:
- Ensure Chrome browser is updated to latest version
- Allow automatic ChromeDriver updates via webdriver-manager
- Manually download compatible ChromeDriver if automatic updates fail
- Check Chrome version compatibility with Selenium WebDriver

### MySQL Service Startup Problems
**Problem**: Cannot connect to MySQL server or database creation fails
**Solutions**:
- Verify MySQL service is running: `sudo systemctl status mysql` (Linux) or equivalent for other OS
- Check MySQL credentials and permissions
- Ensure database `medicines` exists or can be created
- Verify UTF-8 multibyte character set support
- Check firewall settings blocking local connections

### Network Connectivity Issues
**Problem**: Scraper fails due to unstable internet connection
**Solutions**:
- Ensure stable internet connection throughout execution
- Configure proxy settings if behind corporate firewall
- Check access to external APIs (Google search for MRP fallback)
- Monitor network timeouts during scraping

### Memory and Performance Issues
**Problem**: Out of memory errors or slow performance
**Solutions**:
- Increase available RAM or reduce concurrent browser instances
- Adjust browser window size and resource limits
- Monitor memory usage during long-running scrapes
- Consider running on systems with 8GB+ RAM for optimal performance

### Permission and Security Issues
**Problem**: Access denied errors or security restrictions
**Solutions**:
- Verify MySQL user has appropriate privileges
- Check file system permissions for log files
- Ensure antivirus/firewall not blocking Python processes
- Review browser security settings affecting automation

## Installation Instructions

### Step-by-Step Installation Process

#### 1. Install Python 3.x
- Download from python.org or use package manager
- Ensure Python 3.7+ is installed
- Add Python to system PATH

#### 2. Install Required Python Packages
```bash
pip install selenium mysql-connector-python webdriver-manager requests
```

#### 3. Install Chrome Browser
- Download Chrome from google.com/chrome
- Install and update to latest version
- No special configuration required

#### 4. Install and Configure MySQL
- Download MySQL Community Server
- Install with root access enabled
- Create database named `medicines`
- Grant necessary privileges to root user

#### 5. Verify Installation
Run verification commands from the verification section to ensure all components work correctly

#### 6. Run the Scraper
Execute the main script:
```bash
python ready.py
```

### Post-Installation Configuration
- Monitor log files for progress and errors
- Check database for inserted records
- Verify complete execution completion
- Review statistics and error counts

### Maintenance and Updates
- Regularly update Python packages
- Keep Chrome browser updated
- Monitor MySQL server health
- Review and update scraper as needed for website changes