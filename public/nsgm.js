let ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  console.log('Connected to server');
  ws.send(JSON.stringify({ c: 'steam' }));

  ws.onmessage = (data) => {
    try {
      const d = JSON.parse(data.data);
      console.log(d);
      if (d.cb) {
        eval(d.cb);
      }
    } catch (e) {
      console.error("Invalid JSON from client:", data);
    }
  };

  ws.onclose = () => {
    ws.send(JSON.stringify({ c: 'kill' }));

    console.log('Connection closed');
  };
};
ws.onerror=()=>{
  const olh = location.href;
  location.href = 'steam+://';
  location.href = olh;
}

async function getAvailableGames() {
  const apps = this.collectionStore.appTypeCollectionMap.get('type-games');
  const d = { installed: [], available: [] };

  const installedGames = await SteamClient.Storage.GetString('installedGames').catch(undefined => undefined) || '[]';
  d.installed = JSON.parse(installedGames);

  const tasks = apps.allApps.map(async (a) => {
    if (a.BIsShortcut()) {
      const existingGame = d.installed.length>0?d.installed.find(e => e.gameid === a.m_gameid):null;
      if (existingGame && existingGame.id === a.appid) return;

      const appDetails = await appDetailsStore.RequestAppDetails(a.appid).then(e => e);
      d.available.push({
        id: a.appid,
        name: a.display_name,
        gameid: a.m_gameid,
        dir: appDetails?.strShortcutExe,
        profileID: App.m_CurrentUser.strSteamID,
        installed: false
      });
    }
  });

  await Promise.all(tasks);

  d.getAvailableGames = d.installed.length || d.available.length;
  return ws.send(JSON.stringify(d));
}

async function installGame(g) {
  let installedGame = await SteamClient.Storage.GetString('installedGames').catch(undefined => undefined) || '[]';
  installedGame = JSON.parse(installedGame);
  let searchResult = await searchstore.FetchSearchSuggestions(g.name, undefined);
  if (searchResult.total === 0) {
    const dirName = g.dir.split("\\").slice(-2, -1)[0];
    searchResult = await searchstore.FetchSearchSuggestions(dirName, undefined);
  }
  if (searchResult.total !== 0) {
    const response = await fetch(`http://localhost:3005/setup/?appid=${searchResult.items[0].m_unAppID}&dir=${g.dir}&appname=${searchResult.items[0].m_strName}&profileID=${g.profileID}`);
    let res = response.ok;
    let message = await response.text();

    if (res) {
      try {
        SteamClient.Storage.SetString(g.gameid, String(searchResult.items[0].m_unAppID));
        SteamClient.Storage.SetString(String(searchResult.items[0].m_unAppID), g.gameid);
        collectionStore.SetAppsAsHidden([g.id], true);
      await  SteamClient.RoamingStorage.DeleteKey(String(searchResult.items[0].m_unAppID)).catch(undefined=>undefined);
        SteamClient.RoamingStorage.SetString(String(searchResult.items[0].m_unAppID), JSON.stringify({ result: 0 ,gameid: g.gameid}));
        console.log(g.gameid);
        g.appid = searchResult.items[0].m_unAppID;
        g.name = searchResult.items[0].m_strName;
        g.installed = true;        
        installedGame.push(g);
        installedGame = JSON.stringify(installedGame);
        SteamClient.Storage.SetString('installedGames', installedGame);
      } catch (e) {
       await SteamClient.Storage.DeleteKey(String(g.appid)).catch(undefined=>undefined);
       await SteamClient.Storage.DeleteKey(g.gameid).catch(undefined=>undefined);
       await SteamClient.RoamingStorage.DeleteKey(String(searchResult.items[0].m_unAppID)).catch(undefined=>undefined);
        message = e.message;
        res = false;
       await SteamClient.RoamingStorage.DeleteKey(String(g.appid)).catch(undefined=>undefined);
      }
    }

    return ws.send(JSON.stringify({ installGame: true, result: res, message: message }));
  }
}

async function uninstallGame(g) {
  try {
    let installedGame = await SteamClient.Storage.GetString('installedGames').catch(undefined => undefined) || '[]';
    installedGame = JSON.parse(installedGame);

    const target = installedGame.find(e => e.appid === g);
    if (!target) {
      return fetch(`http://localhost:3005/uninstall/?appid=${g}&uninstalled=notfound`);
    }

    installedGame = installedGame.filter(e => e.appid !== g);
    SteamClient.Storage.SetString('installedGames', JSON.stringify(installedGame));
    collectionStore.SetAppsAsHidden([target.id], false);
   await SteamClient.Storage.DeleteKey(target.gameid).catch(undefined=>undefined);
   await SteamClient.Storage.DeleteKey(String(g)).catch(undefined=>undefined);
   await SteamClient.RoamingStorage.DeleteKey(String(g)).catch(undefined=>undefined);
    fetch(`http://localhost:3005/uninstall/?appid=${g}&uninstalled=1`);
  } catch (e) {
    fetch(`http://localhost:3005/uninstall/?appid=${g}&uninstalled=${e.message}`);
  }
}

const SAra = SteamClient.Apps.RegisterForAppDetails;

SteamClient.Apps.RegisterForAppDetails =  function (...args) {
  console.log(args);
    setTimeout(async ()=>{
  const appID = String(args[0]);
  let j;
  try {
   const raw = await SteamClient.RoamingStorage.GetString(appID).catch(() => undefined);
   j = raw ? JSON.parse(raw) : { result: 0 };
 } catch (e) {
   j = { result: 0 };
 }

        
  if (j.result===0&&j.gameid) {
   
      let uu = await fetch(`http://localhost:3005/achievements/?appid=${appID}`);
   if(uu.ok){
      const d = await uu.json();
        if(!d.rgAchievements?.length>0)return;
        j.data= d;
        j.result= 200 / uu.status;
      SteamClient.RoamingStorage.SetString(appID, JSON.stringify(j));
   }
   const a=appStore.GetAppOverviewByAppID(args[0]);
   a.per_client_data[0].display_status = a.per_client_data[0].display_status === 31?11:a.per_client_data[0].display_status;
      }
       

///SteamClient.Apps.RegisterForAppOverviewChanges((e)=>appStore.UpdateAppOverview(e));
        

  },0);

  return SAra.apply(this, args);
};






const SAsc = SteamClient.Apps.SetCachedAppDetails;
SteamClient.Apps.SetCachedAppDetails = async function (...args) {
      const appID = String(args[0]);
      let j;
      try {
       const raw = await SteamClient.RoamingStorage.GetString(appID).catch(() => undefined);
       j = raw ? JSON.parse(raw) : { result: 0 };
     } catch (e) {
       j = { result: 0 };
     }
    if(j.gameid&&j.result===1){
      
       let d= args[1]||'';
if(d?.length&&d?.length>20){
    d= JSON.parse(d);
   (Array.isArray(d) && d[0]?.[1] && d[0][1].version !== 5)
{
        
            
  d[0][1].data.vecUnachieved = j.data.rgAchievements||[];
     d[0][1].data.nTotal = j.data.rgAchievements?.length||0;
        d[0][1].data.vecHighlight = [j.data.rgAchievements[0]]||[];
    d[0][1].version = d[0][1].data.nTotal>0?5:2;
        
     
    }
   args[1] = JSON.stringify(d);
}
const a=appStore.GetAppOverviewByAppID(args[0]);

a.per_client_data[0].display_status = a.per_client_data[0].display_status === 31?11:a.per_client_data[0].display_status;

         
    }
    
   
    return SAsc.apply(this,args);
}



const SAa = SteamClient.Apps.GetMyAchievementsForApp;

SteamClient.Apps.GetMyAchievementsForApp = async function (...args) {  
  console.log(args)
   const appID = String(args[0]);
   let j;
   try {
    const raw = await SteamClient.RoamingStorage.GetString(appID).catch(() => undefined);
    j = raw ? JSON.parse(raw) : { result: 0 };
  } catch (e) {
    j = { result: 0 };
  }
    if(j.gameid&&j.result===1){
        return new Promise(r=>r(j));
    }
  return SAa.apply(this, args);
};


const amuI = setInterval(()=>{
 const amu = appStore?appStore.m_mapApps.updateValue_:null;
 const adt=appDetailsStore?appDetailsStore.m_mapAppData.dehanceValue_:null;

 if(amu&&adt){
  clearInterval(amuI);
  appStore.m_mapApps.updateValue_ =async function (...args) {
   // console.log('update value',args[1]);
      const j =  await SteamClient.Storage.GetString(String(args[0])).catch(undefined=>undefined)||null;
    if(j&&!j.result) {
     if( args[1].app_type!==1){return}
      console.log(j);

     /* args[1].GetPerClientData =  function GetPerClientData(e) {
        let t;
        switch (e) {
        case "local":
            t = this.local_per_client_data;
            break;
        case "mostavailable":
            t = this.most_available_per_client_data;
            break;
        default:
            t = this.selected_per_client_data
        }
    t.display_status = t.display_status === 31?11:t.display_status;
        return t
    };*/
    args[1].per_client_data[0].display_status=args[1].per_client_data[0].display_status === 31?11:args[1].per_client_data[0].display_status;
    args[1].m_gameid = j;
    args[1].gameid = j;
    args[1].GetGameID=()=>j;
    args[1].BIsAppInBlockList = ()=>false;
    args[1].BIsOwned = ()=> true;

    }
            return amu.apply(this, args)
  }
  
  appDetailsStore.m_mapAppData.dehanceValue_ = function (...args) {
    let check = false;
    check = args[0]?.details?.unAppID ? true : false;
    if (!check) return adt.apply(this, args);
    
    setTimeout(async () => {
      const appID = String(args[0].details.unAppID);
      let j;
      try {
        const raw = await SteamClient.RoamingStorage.GetString(appID).catch(() => undefined);
        j = raw ? JSON.parse(raw) : { result: 0 };
            
        if (j.result === 1 && j.gameid) {
          const aDS = args[0].details.achievements;
          if(aDS.nTotal===j.data.rgAchievements.length){return}
          aDS.nAchieved = 0;
          aDS.nTotal = j.data.rgAchievements.length;
          aDS.vecAchievedHidden = [];
          aDS.vecUnachieved = j.data.rgAchievements;
          aDS.vecHighlight = [j.data.rgAchievements[0]];
    
          args[0].details.display_status = args[0].details.display_status === 31 ? 11 : args[0].details.display_status;
          args[0].details.bIsFreeApp = true;
    
          const a = appStore.GetAppOverviewByAppID(args[0].details.unAppID);
          a.per_client_data[0].display_status = a.per_client_data[0].display_status === 31 ? 11 : a.per_client_data[0].display_status;
          a.m_gameid = j.gameid;
         a.gameid = j.gameid;
          a.GetGameID=()=>j.gameid;
          appDetailsStore.AppDetailsChanged(args[0]);
        }
      } catch (e) {
  console.log(e);
      }
    },0);
   return adt.apply(this, args);
  };
  
 }
},1000);

const TerminateApp= SteamClient.Apps.TerminateApp;
SteamClient.Apps.TerminateApp = async function (...args) {
    const e = await SteamClient.Storage.GetString(args[0]).catch(undefined=>undefined)||null;
    if(e&&!e.result)args[0]=e;
        return TerminateApp.apply(this, args);
    }