# Starting on EC2 ARM instance
- curl --silent --location https://rpm.nodesource.com/setup_20.x | bash -
- sudo yum install -y nodejs
- curl -sL https://dl.yarnpkg.com/rpm/yarn.repo | sudo tee /etc/yum.repos.d/yarn.repo
- sudo yum install yarn
- yarn global add pm2
- sudo yum install git
- sudo yum install nginx
- yarn install
- yarn build
- pm2 start yarn --name "Parallelizer" -i max --interpreter bash -- start

<!-- SSL stuff -->
- sudo dnf update -y
- sudo dnf install epel-release -y
- sudo yum install amazon-linux-extras

- sudo dnf install python3 augeas-libs
- sudo python3 -m venv /opt/certbot/
- sudo /opt/certbot/bin/pip install --upgrade pip
- sudo /opt/certbot/bin/pip install certbot certbot-nginx
- sudo ln -s /opt/certbot/bin/certbot /usr/bin/certbot
- sudo certbot --nginx
- echo "0 0,12 * * * root /opt/certbot/bin/python -c 'import random; import time; time.sleep(random.random() * 3600)' && sudo certbot renew -q" | sudo tee -a /etc/crontab > /dev/null
parallelizer.link,www.parallelizer.link