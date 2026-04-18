# nighttune-backend

The API server of Nighttune.

## Table of Contents

1. [Installation methods](#installing)
    - [Docker](#using-docker)
    - [Manually](#manually)

## Installing

The Nighttune API backend can be run/installed manually, and by building and
running a docker container. The easiest and fastest way to get up and running is by using docker.

### Using Docker

To run the Nighttune backend in a docker container, you should be comfortable using
the unix shell and the docker cli.

<details>
<summary>TLDR&semi;</summary>

```bash
git clone https://github.com/houthacker/nighttune-backend.git

# Enter the repository root
cd nighttune-backend

# Either: prepare the required configuration directory structure in a directory of your choosing
# and build the image using default values.
./scripts/docker-image.sh --prepare ~/nighttune-docker

# Or, just prepare the directory and have the image pulled by docker compose.
# Ensure that the pull_policy parameter is removed from the compose file in this case.
./scripts/docker-image.sh --prepare-only ~/nighttune-docker

cd ~/nighttune-docker

# Edit compose.yml and .env to your needs
# ...
# Run the container
docker compose up -d
```

</details>

#### 1. Install Docker

To build the docker container, either [Docker Desktop](https://docs.docker.com/desktop/) or both
[Docker Engine](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/)
are required, so make sure you have either option installed first.

##### Note on Windows

Running Nighttune on Windows has not been tested so please report any issues you might encounter.
Even if you're on Windows, you need access to bash. If you haven't yet, first install a tool
like [Git for Windows](https://git-scm.com/install/windows) which includes git and bash, or install
WSL which also includes git and bash, using PowerShell in administrator mode: `wsl --install`.

#### 2. Building and running

Checkout the repository:

```bash
git clone https://github.com/houthacker/nighttune-backend.git

# Enter the repository root
cd nighttune-backend
```

Then build the container, or pull it from the registry.

```bash
# If you want to, let the build script explain itself:
./scripts/docker-image.sh --help

# Either: prepare the required configuration directory structure in a directory of your choosing
# and build the image using default values.
./scripts/docker-image.sh --prepare ~/nighttune-docker

# Or, just prepare the directory and pull the image.
# Ensure that the pull_policy parameter is removed from the compose file in this case.
./scripts/docker-image.sh --prepare-only ~/nighttune-docker

# Change into that directory and edit the configuration files to your needs.
cd ~/nighttune-docker
````

#### 3. Run the container

```bash
# Change to the configuration directory
cd ~/nighttune-docker

# Run the container
docker compose up -d

# The container should now be reachable at http://localhost:3333
```

### Manually

#### Prerequisites

Please ensure the following prerequisites have been installed. For some tools there are well-known alternatives,
but if you want to use those you're on your own.

| Prerequisite | Notes |
| :--- | :--- |
| [Docker](https://docs.docker.com) | Required only if using the captcha service. |
| [ufw](https://help.ubuntu.com/community/UFW) | Firewall. Required only if Nighttune will be accessed remotely. |
| [npm](https://github.com/nvm-sh) | Node Version Manager |
| [nginx](https://nginx.org) | HTTP web server. Required only if Nighttune will be accessed remotely. |
| [certbot](https://certbot.eff.org/) | A commandline tool to automate certificate administration. Required only when using nginx. |

<details>
<summary>Follow these steps if the captcha service is required.</summary>

#### Docker

Follow [step 1](#1-install-docker) to install docker on your machine.

#### Configure Captcha service

The frontend uses Cap for bot protection and the backend handles the verification.
How to install and configure Cap is described at [Cap](https://capjs.js.org/guide/standalone/).

##### Cap Docker Compose

Copy the template [cap-compose.example.yaml](./examples/cap-compose.example.yaml) to a suitable
directory in your vm and set the `ADMIN_KEY` environment variable to the admin key of your Cap
installation. Ensure any directories mentioned in the compose file have been created.

</details>

<details>

#### Configure ufw

<summary>Follow these steps if your Nighttune instance will be accessed remotely.</summary>

**Important**: In your compose file, ensure that the web service only listens on localhost
(i.e. 127.0.0.1 or ::1), otherwise the web server can still be bypassed because nighttune
will be listening on all interfaces.

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

</details>

#### Checkout the nighttune-backend source code

```bash
git clone https://github.com/houthacker/nighttune-backend.git

# Enter the repository root
cd nighttune-backend
```

#### Copy .env file

Copy your (production) .env file to a suitable directory in your vm.
See [.env.example](./examples/.env.example) for its format.

```bash
# Copy env file to nightscout
$ scp .env.production nightscout.local:~
```

#### Ensure an initialized database exists

<!-- markdownlint-disable -->
```bash
# Create a directory to hold the database. Make sure it doesn't overlap with the repository directory.
$ mkdir -p ~/nighttune-backend/data

# Create or migrate the database
$ docker run --rm --mount type=bind,src=/home/user/nighttune-backend/data,dst=/data ghcr.io/houthacker/nighttune-backend:latest bash -c 'npx initdb /data/nighttune-backend-prod.db'
```
<!-- markdownlint-enable -->

<details>
<summary>Follow these steps if your Nighttune instance will be accessed remotely.</summary>

#### Install nginx

nighttune-backend uses `nginx` as a reverse proxy that also provides the ssl certificates using certbot.

```bash
sudo apt install nginx -y
```

Check if nginx is running. The output should look like the
following:

<!-- markdownlint-disable -->
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
<!-- markdownlint-enable -->

#### Install certbot and configure certifciate

Answer the questions asked by certbot and have your certificates deployed.

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx
```

<details>
<summary>Add captcha config if you require the captcha service.</summary>

#### Add captcha site config

```bash
server {

  # Update to your needs
  server_name captcha.nighttune.local;

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
  ssl_certificate /etc/letsencrypt/live/nighttune.local/fullchain.pem; # managed by Certbot
  ssl_certificate_key /etc/letsencrypt/live/nighttune.local/privkey.pem; # managed by Certbot
  include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot


}

server {
  if ($host = captcha.nighttune.local) {
      return 301 https://$host$request_uri;
  } # managed by Certbot


  listen 80;

  # Keep in sync with server_name at the top of this file.
  server_name captcha.nighttune.local;
  return 404; # managed by Certbot
}

```

</details>

#### Add backend site config

Edit the site config to allow reverse proxying to the backend (or docker container).
An example of this is shown below, assuming `$backend_ip` and `$backend_port` have been set correctly.
Usually, `backend_ip` will be `127.0.0.1` and `backend_port` will be `3333`.

```bash
server {

  # Update to your needs
  server_name api.nighttune.local;

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
  ssl_certificate /etc/letsencrypt/live/nighttune.local/fullchain.pem; # managed by Certbot
  ssl_certificate_key /etc/letsencrypt/live/nighttune.local/privkey.pem; # managed by Certbot
  include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
  if ($host = api.nighttune.local) {
      return 301 https://$host$request_uri;
  } # managed by Certbot


  listen 80;

  # Keep in sync with the server_name at the top of this file.
  server_name api.nighttune.local;
  return 404; # managed by Certbot
}

```

#### Validate site-config

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
</details>
