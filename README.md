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

### Configure Cap

The frontend uses Cap for bot protection and the backend handles the verification.
How to install and configure Cap is described at [Cap](https://capjs.js.org/guide/standalone/).

#### Cap Docker Compose

Copy the template [cap-compose.example.yaml](./examples/cap-compose.example.yaml) to a suitable directory in your vm and set the `ADMIN_KEY` environment
variable to the admin key of your Cap installation. Ensure any directories mentioned in the compose file have been created.

### Copy .env file

Copy your (production) .env file to a suitable directory in your vm. See [.env.example](./examples/.env.example) for its format.

```bash
# Copy env file to nightscout
$ scp .env.production nightscout.app:~
```

### Ensure an initialized database exists

```bash
# Create a directory to hold the database
$ mkdir -p ~/nighttune-backend/data

# Create or migrate the database
$ docker run --rm --mount type=bind,src=/home/houthacker/nighttune-backend/data,dst=/data ghcr.io/houthacker/nighttune-backend:latest bash -c 'npx initdb /data/nighttune-backend-prod.db'
```

### Run the backend Docker container

Copy the template [compose.example.yaml](./examples/compose.example.yaml) to a suitable directory in your vm and run it using `docker compose up -d`. Optionally add a service for the [Nighttune frontend](https://github.com/houthacker/nighttune):

```yaml
services:
  nighttune:
    image: ghcr.io/houthacker/nighttune:latest
    container_name: nighttune
    restart: always
    ports:
      - "127.0.0.1:3000:3000"

```

### Install nginx

nighttune-backend uses `nginx` as a reverse proxy that also provides the ssl certificates using certbot.

```bash
sudo apt install nginx -y
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
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx
```

### Add captcha.nighttune.app site config

```bash
server {

  server_name captcha.nighttune.app;

  location / {
    proxy_pass http://127.0.0.1:3334;
    proxy_buffering off;

    # Let Cap know the IP address of solvers.
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    include proxy_params;
  }

  location /ws/ {
    proxy_pass http://127.0.0.1:3334;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    include proxy_params;
  }

  listen 443 ssl; # managed by Certbot
  ssl_certificate /etc/letsencrypt/live/nighttune.app/fullchain.pem; # managed by Certbot
  ssl_certificate_key /etc/letsencrypt/live/nighttune.app/privkey.pem; # managed by Certbot
  include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot


}

server {
  if ($host = captcha.nighttune.app) {
      return 301 https://$host$request_uri;
  } # managed by Certbot


  listen 80;

  server_name captcha.nighttune.app;
  return 404; # managed by Certbot
}

```

### Add api.nighttune.app site config

Edit the site config to allow reverse proxying to the backend (or docker container). An example of this is shown below, assuming `$backend_ip` and `$backend_port` have been set correctly.
Usually, `backend_ip` will be `127.0.0.1` and `backend_port` will be `3333`.

```bash
server {

  server_name api.nighttune.app;

  location / {
    proxy_pass http://127.0.0.1:3333;
    proxy_buffering off;

    include proxy_params;
  }

  location /ws/ {
    proxy_pass http://127.0.0.1:3333;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    include proxy_params;
  }

  listen 443 ssl; # managed by Certbot
  ssl_certificate /etc/letsencrypt/live/nighttune.app/fullchain.pem; # managed by Certbot
  ssl_certificate_key /etc/letsencrypt/live/nighttune.app/privkey.pem; # managed by Certbot
  include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
  if ($host = api.nighttune.app) {
      return 301 https://$host$request_uri;
  } # managed by Certbot


  listen 80;

  server_name api.nighttune.app;
  return 404; # managed by Certbot
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
