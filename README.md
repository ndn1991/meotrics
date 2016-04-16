# MEOTRICS
Analytics software

# Cài đặt môi trường dev

## Cài đặt chung
1. Trỏ tên miền

	Trỏ danh sách tên miền sau để tiện phát triển hệ thống

	| Tên miền              | Địa chỉ           |
	|-----------------------|-------------------|
	|`meotrics.dev`           | `127.0.0.1`         |
	|`client.meotrics.dev`		| `127.0.0.1`		|

	[window: `Windows\\System32\\drivers\\etc\\host`]
	[linux: ]
	[mac: ]
	
2. config file
   1. Laravel
     **Trong thư mục `/dashboard` tạo một file .env có nội dung giống với `.env.example`, sửa config csdl ở đây**
     Đặt `DB_USERNAME/DB_PASSWORD` là `meotrics/meotrics123`
   2. Nodejs
     **Vào thư mục meotrics/core/config, copy file production.json thành default.json**
      
  2. Danh sách port chuẩn
    
		|process	| port	|
	    |-----------|-------|
	    |nginx     										|`80`		|
	    |nodejs http daskboard api   	|`2108`  |
	    |nodejs http data api 				| `1711` |
	    |mysql     	|`3306`|
	    |mongodb   	|`27017`|
    
3. Yêu cầu cài đặt các module sau
		
	1. Nodejs
	2. Mysql
	3. Mongodb
	3. Redis
	3. Composer
	3. Npm
	3. Nginx hoặc Apache
  
## Cài đặt PHP
1. Cài đặt Composer
	1. Windows
		Download tại [đây](https://getcomposer.org/Composer-Setup.exe)

		**Chú ý** enable module openssl (tìm file php.ini, bỏ comment tất cả các dòng chứa `extension=php_openssl.dll`), mbstring
	1. Linux
      `curl -sS https://getcomposer.org/installer | sudo php -- --install-dir=/usr/local/bin --filename=composer`
	1. Mac
      Cài đặt mcrypt trước, sau đó gõ
      
      ``` 
      brew update
      brew upgrade
      brew tap homebrew/dupes
      brew tap josegonzalez/homebrew-php
      brew install php54-mcrypt
      php --version // To Test your php 
      sudo composer update
      ```

2. Khởi tạo Laravel framework
	Chuyển vào thư mục dashboard (`meotrics/dashboard`), tạo thư mục database, gõ
	
	```
    sudo composer install
    sudo composer update
    sudo chmod -R 777 storage
    ```
## Cài đặt nodejs
1. Cài đặt nodejs
	Chuyển vào thư mục core (`meotrics/core`), gõ
	
	```
    npm install
    ```

## Cài đặt web server
Có thể chạy hệ thống bằng apache hoặc nginx, với mỗi server, copy và sửa các đoạn config như dưới
### APACHE
**Chú ý : Đảm bảo các module dưới đều được load trong file httpd.conf**
  
```
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_ftp_module modules/mod_proxy_ftp.so
LoadModule proxy_http_module modules/mod_proxy_http.so
LoadModule proxy_ajp_module modules/mod_proxy_ajp.so
LoadModule proxy_connect_module modules/mod_proxy_connect.so
```

1.  Apache > 2.2
    ```
    <VirtualHost *:80>
      DocumentRoot "E:\workspace\nodemeotrics\meotrics\dashboard\public"
      ServerName meotrics.dev

      ErrorLog "logs/meotrics.dev-error.log"
      CustomLog "logs/meotrics.dev-access.log" common

      ProxyPreserveHost On
      ProxyPass /api http://127.0.0.1:1711/api
      ProxyPassReverse /api http://127.0.0.1:1711/api
      <Directory />
        Require all granted
        AllowOverride FileInfo Options=MultiViews
      </Directory>
    </VirtualHost>
    
    <VirtualHost *:80>
      DocumentRoot "E:\workspace\nodemeotrics\meotrics\client\client.com"
      ServerName client.meotrics.dev

      ErrorLog "logs/client.meotrics.dev-error.log"
      CustomLog "logs/client.meotrics.dev-access.log" common

      <Directory />
        Require all granted
        AllowOverride FileInfo Options=MultiViews
      </Directory>
    </VirtualHost>
    ```
2. Apache <= 2.2
    ```
    <VirtualHost *:80>
      DocumentRoot "E:\workspace\nodemeotrics\meotrics\dashboard\public"
      ServerName meotrics.dev
      
      ErrorLog "logs/meotrics.dev-error.log"
      CustomLog "logs/meotrics.dev-access.log" common
      
      ProxyPreserveHost On
      ProxyPass /api http://127.0.0.1:1711/api
      ProxyPassReverse /api http://127.0.0.1:1711/api
      
      <Directory />
        AllowOverride FileInfo Options=MultiViews
      </Directory>
    </VirtualHost>
    
    <VirtualHost *:80>
      DocumentRoot "E:\workspace\nodemeotrics\meotrics\client\client.com"
      ServerName client.meotrics.dev
      
      ErrorLog "logs/client.meotrics.dev-error.log"
      CustomLog "logs/client.meotrics.dev-access.log" common
      
      <Directory />
        AllowOverride FileInfo Options=MultiViews
      </Directory>
    </VirtualHost>
    ```
### Nginx
```
server {
  charset utf-8;
  listen 80;

  server_name meotrics.dev;
  root        /home/thanhpk/space/meotrics/dashboard/public/;
  index       index.php;

  access_log  /home/thanhpk/tmp/meotrics-access.log;
  error_log   /home/thanhpk/tmp/meotrics-error.log;

  location /api {
        proxy_pass http://127.0.0.1:1711/api/;
  }
  
  location / {
    try_files $uri $uri/ /index.php?$args;
  }

  location ~ \.php$ {
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME $document_root/$fastcgi_script_name;
    fastcgi_pass   unix:/var/run/php5-fpm.sock;
    try_files $uri =404;
  }

  location ~ /\.(ht|svn|git) {
    deny all;
  }
}

server {
  charset utf-8;
  listen 80;

  server_name client.meotrics.dev;
  root        /home/thanhpk/space/meotrics/dashboard/public/;
  index       index.php;

  access_log  /home/thanhpk/tmp/client.meotrics-access.log;
  error_log   /home/thanhpk/tmp/client.meotrics-error.log;

  location / {
    try_files $uri $uri/ /index.php?$args;
  }

  location ~ \.php$ {
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME $document_root/$fastcgi_script_name;
    fastcgi_pass   unix:/var/run/php5-fpm.sock;
    try_files $uri =404;
  }

  location ~ /\.(ht|svn|git) {
    deny all;
  }
}
```
## Database server
### Mongodb
Chỉ cần cài đặt và chạy mongod ở cổng 27017
### MySql
Tạo tài khoản mysql có tên meotrics/meotrics123
Import database file  `\resources\meotrics_dashboard.sql`
# Chạy chương trình
Sau khi hoàn tất các bước cài đặt, chạy backend bằng lệnh
```
cd core
node app.js
```

Truy cập vào địa chỉ `http://meotrics.dev/auth/login` để đăng nhập

Truy cập vào địa chỉ `http://client.meotrics.dev` để chạy web site client