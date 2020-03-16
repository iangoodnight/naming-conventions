# naming-conventions

A helper application written for Node.js designed to take a list of images from a Google Sheet, rename them by their SKU, updload them to your FTP server, and generate a CSV file.

## Getting Started

### System Requirements

- You will need Node.js installed on your machine to run naming-conventions.  You can find the appropriate version of Node.js [here](https://nodejs.org/en/download/).
	** The file paths referenced within the app are made to run on a Windows system.  Some changes may be required to run on Mac or Linux.

- Clone the repository to your local machine with `git clone git@github.com:iangoodnight/naming-conventions.git` or download the zipped repository [here](https://github.com/iangoodnight/naming-conventions).

- From the CLI, change directories to the unzipped repository and install dependencies with `npm install`

- From a text editor, add the required environmental varialables to the `.env.new` file and rename this file to `.env`

- Run the application with `node . <email>` replacing `<email>` with the email address you would like used in your CSV.
