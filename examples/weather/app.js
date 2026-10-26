let fahrenheit=false,weather;
const byId=id=>document.getElementById(id);
function render(){if(!weather)return;byId('city').textContent=weather.city;byId('temperature').textContent=fahrenheit?(weather.temperatureC*9/5+32).toFixed(1)+' °F':weather.temperatureC+' °C';byId('wind').textContent='Wind '+weather.windKph+' km/h';byId('units').textContent=fahrenheit?'Show Celsius':'Show Fahrenheit';}
async function load(){byId('status').textContent='Loading approved snapshot…';try{const response=await fetch('/api/weather');if(!response.ok)throw Error();weather=await response.json();render();byId('status').textContent='Approved example snapshot loaded.';}catch{byId('status').textContent='Snapshot unavailable.';}}
byId('units').onclick=()=>{fahrenheit=!fahrenheit;render();};byId('refresh').onclick=load;load();
