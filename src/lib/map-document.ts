import { leafletCss, leafletJs } from '../generated/leaflet-assets';
import type { TrackPoint } from './recording';
export type MapData = { points: TrackPoint[]; location?: { latitude: number; longitude: number; accuracy: number | null } | null; places?: { latitude: number; longitude: number; name: string; description?: string; type?: string; services?: string[]; photo?: string }[]; overview?: boolean; offlineRegionId?: string | null };
export const mapDocument = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${leafletCss}html,body,#map{margin:0;width:100%;height:100%;}#message{position:absolute;bottom:28px;left:8px;right:8px;z-index:1000;background:white;font:13px sans-serif;padding:8px;display:none;}#center{position:absolute;top:10px;right:10px;z-index:1000;background:white;border:1px solid #aaa;padding:10px;border-radius:4px;}.popup{font:13px system-ui,sans-serif;max-width:210px}.popup h3{margin:0 0 4px;font-size:15px;color:#123f2d}.popup p{margin:4px 0;color:#43524b;line-height:1.35}.popup img{display:block;width:100%;height:92px;object-fit:cover;border-radius:14px;margin:0 0 8px}.tag{display:inline-block;margin:3px 4px 0 0;padding:3px 7px;border-radius:999px;background:#e8f1eb;color:#163d2d;font-size:11px;font-weight:700}</style></head>
<body><div id="map"></div><button id="center" aria-label="Centrar mi ubicacion">Centrar</button><div id="message" role="status"></div>
<script>${leafletJs.replace(/<\/script/gi, '<\\/script')}</script><script>
const map=L.map('map',{maxZoom:20}).setView([-16.5,-68.15],12), layer=L.layerGroup().addTo(map);
let following=true,lastLocation=null,lastKey='',baseLayer=null,activeOfflineRegion=null;
const tileCache=new Map(),tileRequests=new Map();
const message=document.getElementById('message');
const onlineTiles=()=>L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{subdomains:'abc',maxZoom:20,maxNativeZoom:17,attribution:'Mapas &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA) &mdash; Datos &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'})
.on('tileerror',()=>{message.textContent='Mapa sin conexion. El GPS puede seguir grabando.';message.style.display='block';})
.on('tileload',()=>message.style.display='none');
const OfflineTileLayer=L.GridLayer.extend({createTile:function(coords,done){
  const tile=document.createElement('img');tile.alt='';tile.setAttribute('role','presentation');tile.width=256;tile.height=256;
  const key=activeOfflineRegion+':'+coords.z+':'+coords.x+':'+coords.y;
  const finish=(error,src)=>{if(src)tile.src=src;done(error,tile);};
  if(tileCache.has(key)){finish(null,tileCache.get(key));return tile;}
  if(!window.ReactNativeWebView){finish(new Error('Mapa offline solo disponible en dispositivo'),null);return tile;}
  if(tileRequests.has(key)){tileRequests.get(key).push(finish);return tile;}
  tileRequests.set(key,[finish]);
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'REQUEST_TILE',requestId:key,regionId:activeOfflineRegion,z:coords.z,x:coords.x,y:coords.y}));
  return tile;
}});
function setBaseLayer(regionId){
  if(baseLayer)map.removeLayer(baseLayer);
  activeOfflineRegion=regionId||null;
  baseLayer=activeOfflineRegion?new OfflineTileLayer({tileSize:256,maxZoom:20,attribution:'Mapa offline'}):onlineTiles();
  baseLayer.on('tileerror',()=>{message.textContent='No se encontró este tile offline.';message.style.display='block';});baseLayer.addTo(map);
}
window.receiveTileResponse=function(response){
  if(!response||response.type!=='TILE_RESPONSE')return;
  const callbacks=tileRequests.get(response.requestId)||[];tileRequests.delete(response.requestId);
  if(response.dataUri){tileCache.set(response.requestId,response.dataUri);if(tileCache.size>96)tileCache.delete(tileCache.keys().next().value);callbacks.forEach(done=>done(null,response.dataUri));}
  else callbacks.forEach(done=>done(new Error(response.error||'Tile no disponible'),null));
};
setBaseLayer(null);
map.on('dragstart',()=>following=false);
map.on('zoomstart',()=>following=false);
document.getElementById('center').onclick=()=>{following=true;if(lastLocation)map.setView(lastLocation,16);};
function clean(value){return String(value||'').replace(/[<>&"]/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));}
function placeType(value){return ({campamento:'Campamento',descanso:'Descanso',agua:'Agua',tienda:'Tienda',otro:'Otro'}[value]||value||'Punto');}
function popupFor(place){
  const services=Array.isArray(place.services)?place.services:[];
  const serviceHtml=services.map(item=>'<span class="tag">'+clean(item)+'</span>').join('');
  return '<div class="popup">'+
    (place.photo?'<img src="'+clean(place.photo)+'" alt="Foto del punto">':'')+
    '<h3>'+clean(place.name||'Punto de ruta')+'</h3>'+
    '<p><strong>'+clean(placeType(place.type))+'</strong></p>'+
    (place.description?'<p>'+clean(place.description)+'</p>':'')+
    (serviceHtml?'<p>'+serviceHtml+'</p>':'')+
    '</div>';
}
window.updateRoute=function(data){
  const key=JSON.stringify(data);if(key===lastKey)return;lastKey=key;
  if((data.offlineRegionId||null)!==activeOfflineRegion)setBaseLayer(data.offlineRegionId||null);
  layer.clearLayers();const segments=new Map();
  for(const p of data.points||[]){const segment=segments.get(p.segment)||[];segment.push([p.latitude,p.longitude]);segments.set(p.segment,segment);}
  for(const coordinates of segments.values())L.polyline(coordinates,{color:'#1f6a43',weight:5}).addTo(layer);
  const first=data.points&&data.points[0];
  if(first)L.circleMarker([first.latitude,first.longitude],{radius:7,color:'#1f6a43'}).bindTooltip('Inicio').addTo(layer);
  for(const p of data.places||[]){const label=document.createElement('span');label.textContent=p.name;const marker=L.circleMarker([p.latitude,p.longitude],{radius:8,color:'#ad6419',fillColor:'#fff3df',fillOpacity:.9,weight:3}).bindTooltip(label).bindPopup(popupFor(p),{autoPan:true,maxWidth:260});marker.on('click',()=>marker.openPopup());marker.addTo(layer);}
  const current=data.location||(data.points||[]).slice(-1)[0];
  if(current){lastLocation=[current.latitude,current.longitude];L.circleMarker(lastLocation,{radius:7,color:'#2675ef'}).addTo(layer);
    if(current.accuracy>0)L.circle(lastLocation,{radius:current.accuracy,weight:1,color:'#2675ef',fillOpacity:0.08}).addTo(layer);
    if(following && !data.overview)map.setView(lastLocation,current.accuracy>1000?12:16);}
  if(data.overview && following && data.points.length)map.fitBounds(data.points.map(p=>[p.latitude,p.longitude]),{padding:[25,25],maxZoom:18});
  map.invalidateSize();
};
window.addEventListener('message',event=>{if(event.source===parent&&event.data&&event.data.type==='route')window.updateRoute(event.data.data);});
window.addEventListener('resize',()=>map.invalidateSize());
if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage('ready');else parent.postMessage('map-ready','*');
</script></body></html>`;
