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