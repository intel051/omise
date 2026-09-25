import http from 'node:http';
import {readFile} from 'node:fs/promises';
import handler from './api/search.js';
const files={'/':['public/index.html','text/html'],'/app.js':['public/app.js','text/javascript'],'/stream.js':['public/stream.js','text/javascript'],'/style.css':['public/style.css','text/css'],'/privacy.html':['public/privacy.html','text/html']};
http.createServer(async(req,res)=>{
  res.status=n=>{res.statusCode=n;return res;};res.json=x=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(x));};
  if(req.url==='/api/search'){
    let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>6000)return res.status(413).json({error:'요청이 너무 큽니다.'});}
    try{req.body=body?JSON.parse(body):{};}catch{return res.status(400).json({error:'JSON 형식을 확인해 주세요.'});}return handler(req,res);
  }
  const file=files[new URL(req.url,'http://localhost').pathname];if(!file){res.statusCode=404;return res.end('Not found');}
  try{res.setHeader('Content-Type',file[1]+'; charset=utf-8');res.end(await readFile(file[0]));}catch{res.statusCode=500;res.end('Server error');}
}).listen(3000,()=>console.log('http://localhost:3000'));
