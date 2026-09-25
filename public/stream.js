// Streaming UTF-8 decoder: handles split lines and split multibyte characters.
export async function readEvents(body,onEvent){
 if(!body)throw Error('스트리밍 응답을 읽을 수 없어요.');
 const reader=body.getReader(),decoder=new TextDecoder();let buffer='';
 try{while(true){const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index).trim();buffer=buffer.slice(index+1);if(line)onEvent(JSON.parse(line));}if(buffer.length>1000000)throw Error('응답이 너무 큽니다.');if(done)break;}if(buffer.trim())onEvent(JSON.parse(buffer));}finally{reader.releaseLock();}
}
