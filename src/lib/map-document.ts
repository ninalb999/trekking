import { leafletCss, leafletJs } from '../generated/leaflet-assets';
import type { TrackPoint } from './recording';
export type MapData = { points: TrackPoint[]; location?: { latitude: number; longitude: number; accuracy: number | null } | null; places?: { latitude: number; longitude: number; name: string }[] };
export const mapDocument = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${leafletCss}html,body,#map{margin:0;width:100%;height:100%;}#message{position:absolute;bottom:28px;left:8px;right:8px;z-index:1000;background:white;font:13px sans-serif;padding:8px;display:none;}#center{position:absolute;top:10px;right:10px;z-index:1000;background:white;border:1px solid #aaa;padding:10px;border-radius:4px;}</style></head>
<body><div id="map"></div><button id="center" aria-label="Centrar mi ubicacion">Centrar</button><div id="message" role="status"></div>
<script>${leafletJs.replace(/<\/script/gi, '<\\/script')}</script><script>
const map=L.map('map').setView([-16.5,-68.15],12), layer=L.layerGroup().addTo(map);
let following=true,lastLocation=null,lastKey='';
const message=document.getElementById('message');
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'})
.on('tileerror',()=>{message.textContent='Mapa sin conexion. El GPS puede seguir grabando.';message.style.display='block';})
.on('tileload',()=>message.style.display='none').addTo(map);
map.on('dragstart',()=>following=false);
document.getElementById('center').onclick=()=>{following=true;if(lastLocation)map.setView(lastLocation,16);};
window.updateRoute=function(data){
  const key=JSON.stringify(data);if(key===lastKey)return;lastKey=key;
  layer.clearLayers();const segments=new Map();
  for(const p of data.points||[]){const segment=segments.get(p.segment)||[];segment.push([p.latitude,p.longitude]);segments.set(p.segment,segment);}
  for(const coordinates of segments.values())L.polyline(coordinates,{color:'#1f6a43',weight:5}).addTo(layer);
  const first=data.points&&data.points[0];
  if(first)L.circleMarker([first.latitude,first.longitude],{radius:7,color:'#1f6a43'}).bindTooltip('Inicio').addTo(layer);
  for(const p of data.places||[]){const label=document.createElement('span');label.textContent=p.name;L.circleMarker([p.latitude,p.longitude],{radius:8,color:'#ad6419'}).bindTooltip(label).addTo(layer);}
  const current=data.location||(data.points||[]).slice(-1)[0];
  if(current){lastLocation=[current.latitude,current.longitude];L.circleMarker(lastLocation,{radius:7,color:'#2675ef'}).addTo(layer);
    if(current.accuracy>0)L.circle(lastLocation,{radius:current.accuracy,weight:1,color:'#2675ef',fillOpacity:0.08}).addTo(layer);
    if(following)map.setView(lastLocation,current.accuracy>1000?12:16);}
  map.invalidateSize();
};
window.addEventListener('message',event=>{if(event.source===parent&&event.data&&event.data.type==='route')window.updateRoute(event.data.data);});
window.addEventListener('resize',()=>map.invalidateSize());
if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage('ready');else parent.postMessage('map-ready','*');
</script></body></html>`;
