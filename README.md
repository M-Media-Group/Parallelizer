# Live API Linker

## Starting on EC2 ARM instance
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