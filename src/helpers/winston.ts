import winston = require('winston');
import moment = require('moment');
import fs = require('fs');

const logDir = 'logs';
const env = process.env.NODE_ENV || 'development';
const date = moment(new Date()).format("MMDDYYYY");
const tsFormat = () => (new Date()).toLocaleTimeString();

console.log(date);
console.log(tsFormat);
