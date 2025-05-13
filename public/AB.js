B={get:async ()=>{ cb = await fetch('http://localhost:3000/callback/'+ JSON.stringify({ b: true, get: true }));
cb.json().then( async(res) => {
   if(res?.cb){
       B.cb(cb);
   }else{
 B.data.push(res);}
 await B.get(); 
}).catch(err => {
  B.err = err;
})},
set:async (d,cb)=>{  fetch('http://localhost:3000/callback/'+ JSON.stringify(d));
if(cb){
    new Promise(resolve,reject => {
   b.cb = resolve;
})}
},
err: null,
status:null,
data:null,
cb:null
}


let e = { a: [], b: [], achunk: null, bchunk: null };

app.get('/callback/:data', async (req, res) => {
  let h = JSON.parse(req.params.data);

  const respondLater = (side, data) => {
    if (side === 'a' && e.achunk) {
      e.achunk(data); e.achunk = null;
    } else if (side === 'b' && e.bchunk) {
      e.bchunk(data); e.bchunk = null;
    }
  };

  if (h?.a) {
    if (h.get) {
      if (e.b.length > 0) {
        res.send(JSON.stringify(e.b.shift()));
      } else {
        await new Promise(resolve => {
          e.achunk = (data) => { res.send(JSON.stringify(data)); resolve(); };
        });
      }
    } else if (h.set) {
      e.a.push(h.data);
      respondLater('b', h.data);
      res.send('OK');
    }
  } else {
    if (h.get) {
      if (e.a.length > 0) {
        res.send(JSON.stringify(e.a.shift()));
      } else {
        await new Promise(resolve => {
          e.bchunk = (data) => { res.send(JSON.stringify(data)); resolve(); };
        });
      }
    } else if (h.set) {
      e.b.push(h.data);
      respondLater('a', h.data);
      res.send('OK');
    }
  }
});