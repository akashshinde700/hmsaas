# Installation and Setup

<cite>
**Referenced Files in This Document**
- [ready.py](file://ready.py)
- [medicines_import.sql](file://medicines_import.sql)
- [medwiki_20260330.log](file://medwiki_20260330.log)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Platform-Specific Setup](#platform-specific-setup)
4. [MySQL Database Setup](#mysql-database-setup)
5. [Python Dependencies Installation](#python-dependencies-installation)
6. [Chrome Browser Setup](#chrome-browser-setup)
7. [Environment Configuration](#environment-configuration)
8. [Database Schema Creation](#database-schema-creation)
9. [Verification Steps](#verification-steps)
10. [Troubleshooting Guide](#troubleshooting-guide)
11. [Running the Scraper](#running-the-scraper)

## Introduction
The MedWiki scraper is a Python-based web scraping tool designed to extract medicine information from medwiki.co.in and save it directly to a MySQL database. This comprehensive guide will walk you through the complete installation and setup process for Windows, Linux, and macOS platforms.

## Prerequisites
Before installing the MedWiki scraper, ensure you have the following prerequisites installed on your system:

### Python Requirements
- Python 3.x (recommended: Python 3.8 or higher)
- pip package manager (comes with Python installation)

### Database Requirements
- MySQL Server (version 5.7 or higher recommended)
- MySQL Workbench or command-line client

### Browser Requirements
- Google Chrome browser (latest version recommended)
- ChromeDriver (automatically managed by webdriver-manager)

### System Requirements
- Minimum 4GB RAM recommended
- Stable internet connection
- Administrative privileges for database setup

## Platform-Specific Setup

### Windows Setup

#### Python Installation
1. Download Python 3.x from python.org
2. During installation, ensure you check "Add Python to PATH"
3. Verify installation: `python --version` and `pip --version`

#### MySQL Installation
1. Download MySQL Community Server from mysql.com
2. Choose "Server only" installation for development
3. Set root password during installation
4. Complete installation wizard
5. Verify MySQL service is running in Windows Services

#### Chrome Installation
1. Download Google Chrome from chrome.com
2. Install and verify version compatibility
3. No manual ChromeDriver installation required

### Linux Setup (Ubuntu/Debian)

#### Python Installation
```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv
```

#### MySQL Installation
```bash
sudo apt install mysql-server
sudo mysql_secure_installation
```

#### Chrome Installation
```bash
wget -qO - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
sudo apt update
sudo apt install google-chrome-stable
```

### macOS Setup

#### Python Installation
```bash
# Using Homebrew
brew install python
```

#### MySQL Installation
```bash
brew install mysql
brew services start mysql
```

#### Chrome Installation
```bash
# Download from chrome.com or use Homebrew
brew install --cask google-chrome
```

## MySQL Database Setup

### Creating the Database
1. Connect to MySQL as root user:
```bash
mysql -u root -p
```

2. Create the medicines database:
```sql
CREATE DATABASE IF NOT EXISTS medicines CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

3. Create a dedicated user for the scraper:
```sql
CREATE USER 'medwiki_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON medicines.* TO 'medwiki_user'@'localhost';
FLUSH PRIVILEGES;
```

4. Verify database creation:
```sql
USE medicines;
SHOW TABLES;
```

### Database Configuration
The scraper uses a predefined database configuration. You can modify the credentials in the code:

**Section sources**
- [ready.py:42-49](file://ready.py#L42-L49)

## Python Dependencies Installation

### Required Libraries
The scraper requires the following Python packages:

1. **selenium** - Web automation framework
2. **mysql-connector-python** - MySQL database connector
3. **webdriver-manager** - Automatic ChromeDriver management
4. **requests** - HTTP library for MRP lookup
5. **beautifulsoup4** - HTML parsing library

### Installation Commands
```bash
pip install selenium mysql-connector-python webdriver-manager requests beautifulsoup4
```

### Alternative Installation Method
The scraper automatically installs missing dependencies:
- mysql-connector-python is automatically installed if not found
- Other dependencies must be manually installed

**Section sources**
- [ready.py:23-29](file://ready.py#L23-L29)

## Chrome Browser Setup

### ChromeDriver Management
The scraper uses webdriver-manager for automatic ChromeDriver management:

1. **Automatic Detection**: webdriver-manager automatically detects your Chrome version
2. **Driver Installation**: Downloads compatible ChromeDriver version
3. **Cache Management**: Stores drivers in local cache for future use

### Chrome Options Configuration
The scraper sets up Chrome with optimized options:
- Headless mode disabled for reliability
- Maximum window size (1920x1080)
- Anti-detection measures enabled
- Custom user agent configured

**Section sources**
- [ready.py:290-326](file://ready.py#L290-L326)
- [ready.py:309-316](file://ready.py#L309-L316)

## Environment Configuration

### Database Credentials
Configure the database connection in the code:

```python
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',  # Change to your MySQL username
    'password': 'root',  # Change to your MySQL password
    'database': 'medicines',
    'charset': 'utf8mb4',
}
```

### Environment Variables
While the scraper uses hardcoded credentials, you can modify them for production use:

1. **DATABASE_HOST**: MySQL server hostname/IP
2. **DATABASE_USER**: Database username
3. **DATABASE_PASSWORD**: Database password
4. **DATABASE_NAME**: Target database name

### Log Configuration
The scraper creates daily log files with timestamped filenames:
- Log files stored in the same directory as the script
- UTF-8 encoding support
- Console and file logging enabled

**Section sources**
- [ready.py:32-40](file://ready.py#L32-L40)

## Database Schema Creation

### Automatic Schema Creation
The scraper automatically creates the medicines table if it doesn't exist:

```sql
CREATE TABLE IF NOT EXISTS `medicines` (
    `id` int NOT NULL AUTO_INCREMENT,
    `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `generic_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `brand` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `manufacturer` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `dosage_form` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `strength` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `pack_size` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `therapeutic_class` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `pharmacological_class` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `atc_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `snomed_id` bigint unsigned DEFAULT NULL,
    `rxnorm_id` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `mrp` decimal(12,2) DEFAULT NULL,
    `purchase_price` decimal(12,2) DEFAULT NULL,
    `schedule` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `is_controlled` tinyint(1) DEFAULT '0',
    `is_narcotic` tinyint(1) DEFAULT '0',
    `requires_prescription` tinyint(1) DEFAULT '1',
    `default_dosage` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `default_frequency` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `default_duration` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    `default_route` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Oral',
    `default_instructions` text COLLATE utf8mb4_unicode_ci,
    `usage_count` int DEFAULT '0',
    `last_used_at` timestamp NULL DEFAULT NULL,
    `is_active` tinyint(1) DEFAULT '1',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_name_generic` (`name`(100), `generic_name`(100)),
    KEY `idx_medicines_name` (`name`),
    KEY `idx_medicines_generic` (`generic_name`),
    KEY `idx_medicines_brand` (`brand`),
    KEY `idx_medicines_category` (`category`),
    KEY `idx_medicines_therapeutic` (`therapeutic_class`),
    KEY `idx_medicines_active_popular` (`is_active`,`usage_count`),
    KEY `idx_medicines_controlled` (`is_controlled`),
    FULLTEXT KEY `ft_medicines_search` (`name`,`generic_name`,`brand`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Manual Schema Creation
If you prefer to create the schema manually:

1. Connect to MySQL: `mysql -u root -p medicines`
2. Copy and paste the schema from the medicines_import.sql file
3. Execute the SQL commands

**Section sources**
- [ready.py:72-115](file://ready.py#L72-L115)
- [medicines_import.sql:15-60](file://medicines_import.sql#L15-L60)

## Verification Steps

### Database Connection Test
1. Test MySQL connection:
```bash
mysql -u root -p -e "USE medicines; SHOW TABLES;"
```

2. Verify table creation:
```sql
DESCRIBE medicines;
```

### Python Environment Test
1. Test Python imports:
```python
python -c "import selenium; import mysql.connector; import requests; print('All imports successful')"
```

2. Test ChromeDriver detection:
```python
python -c "from selenium import webdriver; from webdriver_manager.chrome import ChromeDriverManager; print('ChromeDriver manager working')"
```

### Network Connectivity Test
1. Test website accessibility:
```bash
curl -I https://medwiki.co.in
```

2. Test MRP lookup functionality:
```python
python -c "import requests; response = requests.get('https://www.google.com'); print('Google accessible:', response.status_code)"
```

### Scraper Validation
1. Run a small test scrape:
```bash
python ready.py
```

2. Monitor log file for successful initialization:
```bash
tail -f medwiki_YYYYMMDD.log
```

**Section sources**
- [ready.py:67-136](file://ready.py#L67-L136)
- [medwiki_20260330.log:1-80](file://medwiki_20260330.log#L1-L80)

## Troubleshooting Guide

### Common Installation Issues

#### MySQL Connection Errors
**Problem**: `mysql.connector.errors.ProgrammingError: 2003 (HY000): Can't connect to MySQL server`
**Solution**:
1. Verify MySQL service is running
2. Check firewall settings
3. Test connection: `mysql -u root -p`
4. Verify MySQL is listening on localhost

#### Permission Denied Errors
**Problem**: `Access denied for user 'root'@'localhost'`
**Solution**:
1. Reset MySQL root password
2. Create dedicated user with proper privileges
3. Verify user permissions: `SHOW GRANTS FOR 'username'@'localhost';`

#### ChromeDriver Compatibility Issues
**Problem**: `SessionNotCreatedException: Message: session not created`
**Solution**:
1. Update Chrome browser to latest version
2. Clear webdriver-manager cache: `rm -rf ~/.wdm/`
3. Manually download compatible ChromeDriver
4. Check Chrome version: `google-chrome --version`

#### Selenium Import Errors
**Problem**: `ModuleNotFoundError: No module named 'selenium'`
**Solution**:
1. Install selenium: `pip install selenium`
2. Verify installation: `pip list | grep selenium`
3. Check Python interpreter path

#### Network Connectivity Issues
**Problem**: Timeout errors when accessing medwiki.co.in
**Solution**:
1. Check internet connection
2. Test proxy settings
3. Add retry logic in code
4. Use VPN if blocked regionally

### Performance Optimization

#### Memory Management
1. Monitor memory usage during scraping
2. Adjust timeout values for slow connections
3. Implement rate limiting to prevent blocking

#### Database Performance
1. Monitor query performance
2. Optimize indexes for frequent queries
3. Consider connection pooling for large datasets

#### Logging and Monitoring
1. Enable debug logging for troubleshooting
2. Monitor log file sizes
3. Implement log rotation for production use

**Section sources**
- [ready.py:134-136](file://ready.py#L134-L136)
- [ready.py:324-326](file://ready.py#L324-L326)

## Running the Scraper

### Initial Setup
1. Ensure all prerequisites are installed
2. Configure database credentials
3. Verify MySQL connection
4. Test ChromeDriver detection

### First Run
1. Navigate to project directory
2. Run the scraper: `python ready.py`
3. Monitor console output and log files
4. Check database for inserted records

### Monitoring Progress
1. Check log files for progress indicators
2. Monitor database table growth
3. Watch for error messages in console
4. Verify MRP lookup functionality

### Stopping the Scraper
1. Press Ctrl+C to stop gracefully
2. The scraper will attempt to clean up resources
3. Check for any remaining browser instances
4. Verify database transactions are committed

### Post-Run Verification
1. Count inserted records: `SELECT COUNT(*) FROM medicines;`
2. Check for duplicates: `SELECT name, COUNT(*) FROM medicines GROUP BY name HAVING COUNT(*) > 1;`
3. Verify data quality: `SELECT * FROM medicines LIMIT 10;`
4. Review log files for any errors

**Section sources**
- [ready.py:656-780](file://ready.py#L656-L780)
- [medwiki_20260330.log:73-80](file://medwiki_20260330.log#L73-L80)