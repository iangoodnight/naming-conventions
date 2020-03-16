const Fs = require('fs');
const dotenv = require('dotenv');
const Path = require('path');
const Axios = require('axios');
//  Not sure if I will end up using fetch or axios
const fetch = require('node-fetch');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const promisify = require('promisify-node');
const PromiseFtp = require('promise-ftp');
const fsp = promisify('fs');

dotenv.config({ path: '.env'});

// sheets endpoint formatted for JSON
const landingZone = process.env.LANDING_ZONE;
const _ftp = new PromiseFtp();
const _localFilePath = './images/';
const _remoteFilePath = '';
const DOWNLOAD_DIR = Path.join(process.env.HOME || process.env.USERPROFILE, '\\Downloads\\products - images ' + Date.now() + '.csv');

const csvWriter = createCsvWriter({
	path: DOWNLOAD_DIR,
	alwaysQuote: true,
	header: [
		{id: 'sku', title:'sku'},
		{id: 'name', title:'name_en'},
		{id: 'vendor', title: 'vendor'},
		{id: 'path', title: 'images'}
	]
});

function validateEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (re.test(String(email).toLowerCase())) {
    	console.log("Email validated.  Great Job!");
    } else {
    	console.log("Bad email... leaving empty");
    }
    return re.test(String(email).toLowerCase());
}

const vendor = validateEmail(process.argv[2]) ? process.argv[2]  : '';

function Ftp(env) {
	this.config = {
		host: process.env.FTP_HOST,
		user: process.env.FTP_USERNAME,
		password: process.env.FTP_PASS
	}
}

Ftp.prototype.mput = function(fileList) {
	_ftp.connect(this.config)
		.then(() => multiPutFiles(fileList))
		.then(() => {
			console.log('disconnecting...')
			clearDir()
			return _ftp.end()
		})
		.catch((err) => { console.log(err.toString()) })
}

Ftp.prototype.publish = function(ext) {
	return fsp.readdir(_localFilePath)
		.then(function(files) {
			const pattern = new RegExp('.' + ext.join('|.'))
			return files.filter((file) => pattern.test(file))
		})
}

function multiPutFiles(fileList) {
	return new Promise(function(resolve, reject) {
		let chain = Promise.resolve()
		console.log('CSV generated!');

		fileList.forEach(function(file, i, arr) {
			chain = chain.then(() => {
				console.log('uploading: ', _localFilePath + file)
				return _ftp.put(_localFilePath + file, _remoteFilePath + file)
			})
			.catch((err) => { console.log(err.toString()) })

			if (i === arr.length - 1)
				chain.then(() => resolve())
		})
	})
}

// fetch lists or image urls with their new names
function takeNames(url) {
	return fetch(url)
		.then(res => res.json())
}

// pulls the vital information out of the response from takeNames for use in the next process
function shuckThis(body) {
	return new Promise(function(resolve, reject) {
		let entries = body.feed.entry;
		let images = [];
		let skus = [];
		let names = [];
		let types = [];
		let imageRoot = 'https://www.boutsy.com/Temp_Image_Import/'
		for (let i = 0; i < entries.length; i++) {
			let row = Number(entries[i].gs$cell.row);
			let content = entries[i].content.$t;
			if (row >= 5) {
				switch (Number(entries[i].gs$cell.col)) {
					case 1:
						let extension = content.split(/\#|\?/)[0].split('.').pop().trim();
						types.push(extension);
						images.push({
							index: row,
							image: content,
							ext: extension,
							vendor: vendor
						});
						break;
					case 2:	
						let uri = imageRoot + content;
						let newPath = encodeURI(uri);
						skus.push({
							index: row,
							sku: content,
							path: newPath
						});
						break;
					case 3:
						names.push({
							index: row,
							name: content
						})
						break;
					default:
						break;					
				}
			}
		};
		let ledger = images.map((item, i) => Object.assign({}, item, skus[i], names[i]));
		const fileTypes = [...new Set(types)];
		for (const v of ledger) {
			v.path = v.path + '.' + v.ext;
		}
		console.log(ledger);
		console.log(fileTypes);
		console.log('...Building CSV');
		return csvWriter.writeRecords(ledger)
			.then(() => resolve({
				ledger: ledger,
				fileTypes: fileTypes
			}));
	});
}

async function loop(obj) {
	for (let i = 0; i < obj.ledger.length; i++) {
		await downloadImage(obj.ledger[i]);
	};

	return obj;

}

// This will be the actual image downloader
async function downloadImage(info) {
	const url = info.image;
	const sku = info.sku + '.' + info.ext;
	const path = Path.resolve(__dirname, 'images', sku);
	const writer = Fs.createWriteStream(path)

	const response = await Axios({
		url,
		method: 'GET',
		responseType: 'stream'
	});

	response.data.pipe(writer);

	return new Promise((resolve, reject) => {
		writer.on('finish', resolve)
		writer.on('error', reject)
	})

}

async function clearDir() {

	Fs.readdir(_localFilePath, async (err, files) => {
		if (err) throw err;
		console.log('Cleaning up...');

		for (const file of files) {
			await Fs.unlink(Path.join(_localFilePath, file), err => {
				if (err) throw err;
			});
		}
	});
}

const ftp = new Ftp();

takeNames(landingZone)
	.then(shuckThis)
	.then(data => loop(data))
	.then(data => ftp.publish(data.fileTypes)
	.done((files) => ftp.mput(files)))
	.catch(err => console.log(err))