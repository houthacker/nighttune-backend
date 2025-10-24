# nighttune-backend
The API server of nighttune.

## Table of Contents
1. [Prerequisites](#1-prerequisites)
    1. [Configure ufw](#configure-ufw)
    2. [Install nginx](#install-nginx)
    3. [Install certbot](#install-certbot-and-configure-certifciate)

### Installing

#### 1. Prerequisites
Please ensure the following prerequisites have been installed:
| Prerequisite | Notes |
| :--- | :--- |
| [Docker Engine](https://docs.docker.com/engine/install/) | |
| [nvm](https://github.com/nvm-sh/nvm) | Node Version Manager |
| [dotenvx](https://dotenvx.com/docs/install) | secure dotenv files |
| [certbot](https://certbot.eff.org/) | A commandline tool to automate certificate administration. |

### Configure ufw
Deny all incoming traffic by default, but leave ssh, http and https open.
```bash
$ sudo systemctl enable ufw
$ sudo ufw enable

# Allow ssh from your ip
$ sudo ufw allow from $your_ip to any port 22

# Or from any ip
$ sudo ufw allow 22/tcp

# Allow http, https
$ sudo ufw allow http
$ sudo ufw allow https

# Deny all other incoming traffic by default
$ sudo ufw default deny incoming
```

### Configure Cloudflare Turnstile
The frontend uses Cloudflare Turnstile for bot protection and the backend handles the verification.
How to configure Turnstile is described at [Cloudflare](https://developers.cloudflare.com/turnstile/).

### Copy .env file
Copy your secured (production) .env file to the vm. See [.env.example](./examples/.env.example) for its format.
```bash
$ scp .env.keys nightscout.app:~
$ scp .env.production nightscout.app:~
```

### Run the backend Docker container 
Ensure the container does not expose its ports to the internet.
```bash
$ backend_port=3333
$ docker run --name nighttune-backend -v ./.env.production:/app/.env -v ./.env.keys:/app/.env.keys -p 127.0.0.1:$backend_port:$backend_port --detach ghcr.io/houthacker/nighttune-backend:latest
```

### Install nginx
nighttune-backend uses `nginx` as a reverse proxy that also provides the ssl certificates using certbot.

```bash
$ sudo apt install nginx -y
```

Check if nginx is running. The output should look like the
following:
```bash
$ sudo systemctl status nginx
● nginx.service - A high performance web server and a reverse proxy server
    Loaded: loaded (/usr/lib/systemd/system/nginx.service; enabled; preset: enabled)
    Active: active (running) since Sat 2025-10-18 15:45:36 CEST; 41s ago
      Docs: man:nginx(8)
   Process: 23433 ExecStartPre=/usr/sbin/nginx -t -q -g daemon on; master_process on; (code=exited, status=0/SUCCESS)
   Process: 23434 ExecStart=/usr/sbin/nginx -g daemon on; master_process on; (code=exited, status=0/SUCCESS)
  Main PID: 23465 (nginx)
     Tasks: 3 (limit: 4595)
    Memory: 2.4M (peak: 5.3M)
       CPU: 55ms
    CGroup: /system.slice/nginx.service
            ├─23465 "nginx: master process /usr/sbin/nginx -g daemon on; master_process on;"
            ├─23467 "nginx: worker process"
            └─23468 "nginx: worker process"
```

### Install certbot and configure certifciate
Answer the questions asked by certbot and have your certificates deployed.
```bash
$ sudo apt install certbot python3-certbot-nginx
$ sudo certbot --nginx
```

### Add reverse proxy config
Edit the site config to allow reverse proxying to the backend docker container. An example of this is shown below, assuming `$backend_ip` and `$backend_port` have been set correctly. See [api.nighttune.app.example](./examples/api.nighttune.app.example) for a full example nginx site config.
```bash
  location / {
    proxy_pass http://$backend_ip:$backend_port;
    proxy_buffering off;

    include proxy_params;
  }

	location /ws/ {
		proxy_pass http://$backend_ip:$backend_port;
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "upgrade";
		
		include proxy_params;
	}
```

### Check site-config 
If checking the site configuration is successful, reload nginx.
```bash
$ sudo nginx -t
[sudo] password for houthacker:
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful

# Then reload nginx
$ sudo systemctl reload nginx
```

Afther this, the backend should be reachable at the location you configured; congrats!

### Install and configure MQTT
We're using MQTT as a pubsub broker, to add asynchronicity to the data flow. This prevents 
blocking for users who add a job when the queue is 'full', and job processing independent of
that queue. 
```bash
# Install mosquitto server and -client 
$ sudo apt install mosquitto mosquitto-clients

# Check status (should be running and active)
$ sudo systemctl status mosquitto
● mosquitto.service - Mosquitto MQTT Broker
     Loaded: loaded (/usr/lib/systemd/system/mosquitto.service; enabled; preset: enabled)
     Active: active (running) since Thu 2025-10-23 19:56:33 CEST; 19s ago
       Docs: man:mosquitto.conf(5)
             man:mosquitto(8)
    Process: 3533 ExecStartPre=/bin/mkdir -m 740 -p /var/log/mosquitto (code=exited, status=0/SUCCESS)
    Process: 3535 ExecStartPre=/bin/chown mosquitto:mosquitto /var/log/mosquitto (code=exited, status=0/SUCCESS)
    Process: 3537 ExecStartPre=/bin/mkdir -m 740 -p /run/mosquitto (code=exited, status=0/SUCCESS)
    Process: 3539 ExecStartPre=/bin/chown mosquitto:mosquitto /run/mosquitto (code=exited, status=0/SUCCESS)
   Main PID: 3540 (mosquitto)
      Tasks: 1 (limit: 4595)
     Memory: 1.0M (peak: 1.6M)
        CPU: 46ms
     CGroup: /system.slice/mosquitto.service
             └─3540 /usr/sbin/mosquitto -c /etc/mosquitto/mosquitto.conf

Oct 23 19:56:33 nighttune.app systemd[1]: Starting mosquitto.service - Mosquitto MQTT Broker...
Oct 23 19:56:33 nighttune.app systemd[1]: Started mosquitto.service - Mosquitto MQTT Broker.
```

#### Obtain a certificate for the mosquitto domain
```bash
# Stop nginx first
$ sudo systemctl stop nginx

# Request the certificate, replace 'mqtt.yourdomain.com' with your own domain.
$ sudo certbot certonly --standalone -d <mqtt.yourdomain.com>

# Start nginx
$ sudo systemctl start nginx
```

#### Configure mqtt to use TLS
```bash
# Edit or create the tls configuration file, replace 'mqtt.yourdomain.com' with your own domain.
$ sudo cat << EOF > /etc/mosquitto/conf.d/tls.conf

# TLS connection
listener 8883 mqtt.yourdomain.com
protocol mqtt
cafile /etc/letsencrypt/live/mqtt.yourdomain.com/chain.pem
certfile /etc/letsencrypt/live/mqtt.yourdomain.com/cert.pem
keyfile /etc/letsencrypt/live/mqtt.yourdomain.com/privkey.pem
tls_version tlsv1.2
allow_anonymous false
use_username_as_clientid true
EOF
```

#### Ensure the mosquitto service file uses the correct user
```bash
$ sudo nano /usr/lib/systemd/system/mosquitto.service

# Ensure the [Service] section contains the following entries:
User=mosquitto
Group=mosquitto

# If you updated the file, run the following:
$ sudo systemctl daemon-reload
$ sudo systemctl restart mosquitto
```

#### Allow mqtt to read certificates
```bash
$ sudo chmod -R 640 /etc/letsencrypt/live
$ sudo chmod -R 640 /etc/letsencrypt/archive
$ sudo chown -R root:ssl-cert /etc/letsencrypt/live
$ sudo chown -R root:ssl-cert /etc/letsencrypt/archive

# Add mosquitto to the ssl-cert group
$ sudo usermod -aG ssl-cert mosquitto

# Install acl and set extended ACLs on the letsencrypt directories.
$ sudo apt install acl

# Recursively modify the ACL of the letsencrypt directories by 
# allowing user 'mosquitto' read access to files and execute access 
# to directories.
$ sudo setfacl -R -m u:mosquitto:rX /etc/letsencrypt/{live,archive}

# Restart mosquitto
$ sudo systemctl restart mosquitto
```

#### Setup Mosquitto Dynamic Security
Secure the mosquitto instance, create users, groups, roles and topics. Details on how to do this are at [Mosquitto Dynamic Security](https://mosquitto.org/documentation/dynamic-security/).

At a high level, configuration should be:
| User | Group |
| :--- | :--- |
| `admin` | `admin` |
| `nighttune-submitter-test` | `submitters-test` |
| `nighttune-submitter-prod` | `submitters-prod` |
| `nighttune-executor-test` | `executor-test` |
| `nighttune-executor-prod` | `executor-prod` |

| Group | Role(s) |
| :--- | :--- |
| `admin` | `admin` |
| `submitters-test` | `submit-test` |
| `submitters-prod` | `submit-prod` |
| `executors-test` | `execute-test` |
| `executors-prod` | `execute-prod` |

| Role | Topic | ACLs |
| :--- | :--- | :--- |
| `admin` | `$CONTROL/dynamic-security/#` | `publishClientSend,publishClientReceive,subscribePattern` |
| `admin` | `$SYS/#` | `publishClientReceive,subscribePattern` |
| `admin` | `#` | `publishClientReceive,subscribePattern,unsubscribePattern` |
| `submit-test` | `test/nighttune/jobs/#` | `publishClientSend` |
| `submit-prod` | `nighttune/jobs/#` | `publishClientSend` |
| `execute-test` | `test/nighttune/jobs/#` | `publishClientReceive,subscribePattern,unsubscribePattern` |  
| `execute-prod` | `nighttune/jobs/#` | `publishClientReceive,subscribePattern,unsubscribePattern` |

```bash
# Add dynsec configuration
$ sudo cat << EOF > /etc/mosquitto/conf.d/dynsec.conf
plugin /usr/lib/x86_64-linux-gnu/mosquitto_dynamic_security.so
plugin_opt_config_file /etc/mosquitto/dynamic-security.json

per_listener_settings false
EOF

# Use mosquitto_ctrl to add admin user
$ sudo mosquitto_ctrl dynsec init /etc/mosquitto/dynamic-security.json admin

# Finally, open the mqtts port
$ sudo ufw allow from $your_ip to any port 8883
$ sudo ufw reload
```

#### Manage Mosquitto Dynamic Security
MQTT Dynamic Security can be managed using `mosquitto_ctrl`, or using a web interface provided by cedalo. We're going to use the latter.
```bash
# Add yarn package manager repository
$ curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add - 
$ echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list

# Install yarn (required to build and install management center)
$ sudo apt update
$ sudo apt install yarn

# Clone git repository
$ git clone https://github.com/cedalo/management-center.git

# Install. Takes a few minutes.
$ cd management-center
$ yarn install

# Build the frontend
$ cd frontend
$ yarn run build-without-base-path

# Export env variables
$ cd ../backend
$ cat << EOF > env.sh
export CEDALO_MC_BROKER_ID="mosquitto"
export CEDALO_MC_BROKER_NAME="Mosquitto"
export CEDALO_MC_BROKER_URL="mqtts://mqtt.yourdomain.com:8883"
export CEDALO_MC_BROKER_USERNAME="user"
export CEDALO_MC_BROKER_PASSWORD="p@ssw0rd"
export CEDALO_MC_USERNAME="cedalo"
export CEDALO_MC_PASSWORD="tests"
export CEDALO_MC_PROXY_HOST="localhost"
EOF

# Make it executable
$ chmod +x env.sh

# and run MC
$ . env.sh
$ yarn start
```

Create a nginx site for remote configuration
```bash
# /etc/nginx/sites-available/mqtt.yourdomain.com
server {
	listen 80;

	root /var/www/html;

	# Add index.php to the list if you are using PHP
	index index.html index.htm index.nginx-debian.html;

	server_name _;

	location / {
		# First attempt to serve request as file, then
		# as directory, then fall back to displaying a 404.
		try_files $uri $uri/ =404;
	}

}


server {

	root /var/www/html;

	# Add index.php to the list if you are using PHP
	index index.html index.htm index.nginx-debian.html;
	server_name mqtt.yourdomain.com; # managed by Certbot


	location / {
		# First attempt to serve request as file, then
		# as directory, then fall back to displaying a 404.
		proxy_pass http://127.0.0.1:8088;
		proxy_buffering off;

		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "upgrade";

		include proxy_params;
	}

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/mqtt.yourdomain.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/mqtt.yourdomain.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

}
server {
    if ($host = mqtt.yourdomain.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


	listen 80 ;
	listen [::]:80 ;
    server_name mqtt.yourdomain.com;
    return 404; # managed by Certbot


}

```

Enable site and reload nginx
```bash
$ sudo ln -s /etc/nginx/sites-available/mqtt.yourdomain.com /etc/nginx/sites-enabled/mqtt.yourdomain.com

$ sudo systemctl reload nginx

# Now use the management console at https://mqtt.yourdomain.com with the credentials from `env.sh`.
```