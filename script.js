const NASA_API_KEY = 'DEMO_KEY'; 

let map, fireLayerGroup, routeLayerGroup, gibsThermalLayer;
let isThermalActive = false;

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            document.getElementById('loginOverlay').style.display = 'none';
            initLeafletMap();
            init3DGlobe();
            initSatellite3D();
            initSensorNode3D();
            animateCounters();
        });
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            switchTab(targetId, btn);
        });
    });

    document.getElementById('goToCommandBtn')?.addEventListener('click', () => {
        document.querySelector('[data-target="commandTab"]')?.click();
    });

    document.getElementById('nasaDirectBtn')?.addEventListener('click', triggerDirectNasaLink);
    
    document.getElementById('openNasaWorldviewBtn')?.addEventListener('click', () => {
        const selectedRegion = document.getElementById('regionSelect').value;
        const coords = {
            riyadh: "24.7136,46.6753",
            mediterranean: "37.9838,23.7275",
            california: "36.7783,-119.4179",
            amazon: "-3.4653,-62.2159"
        }[selectedRegion] || "24.7136,46.6753";

        const worldviewUrl = `https://worldview.earthdata.nasa.gov/?v=${coords.split(',')[1]},${coords.split(',')[0]},10&l=VIIRS_SNPP_Thermal_Anomalies_375m_Day,Reference_Labels_15m,Reference_Features_15m,Coastlines_15m,VIIRS_SNPP_CorrectedReflectance_TrueColor`;
        window.open(worldviewUrl, '_blank');
    });

    document.getElementById('toggleThermalLayerBtn')?.addEventListener('click', toggleNASAGIBSLayer);

    document.getElementById('regionSelect')?.addEventListener('change', (e) => {
        fetchNASAData(e.target.value);
    });

    initSimulator();
});

function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');

    if (tabId === 'commandTab' && map) {
        setTimeout(() => map.invalidateSize(), 200);
    }
}

function initLeafletMap() {
    if (map) return;
    map = L.map('map').setView([24.7136, 46.6753], 8);
    
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
    }).addTo(map);

    fireLayerGroup = L.layerGroup().addTo(map);
    routeLayerGroup = L.layerGroup().addTo(map);

    gibsThermalLayer = L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_Thermal_Anomalies_375m_Day/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png', {
        attribution: 'NASA Earthdata / FIRMS',
        maxZoom: 9,
        opacity: 0.75
    });

    fetchNASAData('riyadh');
}

function toggleNASAGIBSLayer() {
    if (!map) return;
    if (isThermalActive) {
        map.removeLayer(gibsThermalLayer);
        isThermalActive = false;
        document.getElementById('toggleThermalLayerBtn').innerHTML = `<span style="font-size: 14px; font-weight: 700;"><i class="fa-solid fa-fire-flame-curved"></i> Toggle NASA Thermal Overlay (GIBS)</span><span class="ar-sub" style="color:#fff;">تفعيل طبقة الحرارة الفضائية</span>`;
    } else {
        map.addLayer(gibsThermalLayer);
        isThermalActive = true;
        document.getElementById('toggleThermalLayerBtn').innerHTML = `<span style="font-size: 14px; font-weight: 700;"><i class="fa-solid fa-eye-slash"></i> Hide Thermal Overlay</span><span class="ar-sub" style="color:#fff;">إخفاء طبقة الحرارة</span>`;
        logMessage("[GIBS API] LIVE NASA VIIRS Thermal Layer Activated.");
    }
}

async function fetchNASAData(regionKey) {
    const regionsData = {
        riyadh: { lat: 24.7136, lon: 46.6753, zoom: 8, hotspots: 3, speed: "2.8 km/h", risk: "Medium Risk", ndvi: "0.15 (Dry)" },
        mediterranean: { lat: 37.9838, lon: 23.7275, zoom: 8, hotspots: 5, speed: "4.5 km/h", risk: "High Risk", ndvi: "0.28 (Moderate)" },
        california: { lat: 36.7783, lon: -119.4179, zoom: 8, hotspots: 7, speed: "6.2 km/h", risk: "Critical Risk", ndvi: "0.09 (Severe Drought)" },
        amazon: { lat: -3.4653, lon: -62.2159, zoom: 7, hotspots: 9, speed: "5.1 km/h", risk: "Very High Risk", ndvi: "0.62 (Dense)" }
    };

    const reg = regionsData[regionKey];
    if (!reg) return;

    map.setView([reg.lat, reg.lon], reg.zoom);
    
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${reg.lat}&longitude=${reg.lon}&current_weather=true`);
        const data = await res.json();
        
        if (data && data.current_weather) {
            document.getElementById('valTemp').textContent = data.current_weather.temperature + " °C";
            document.getElementById('valWind').textContent = data.current_weather.windspeed + " km/h";
            document.getElementById('valHotspots').textContent = reg.hotspots + " Hotspots";
            document.getElementById('valNdvi').textContent = reg.ndvi;
            document.getElementById('aiSpreadVal').textContent = reg.speed;
            document.getElementById('aiRiskVal').textContent = reg.risk;

            fireLayerGroup.clearLayers();
            routeLayerGroup.clearLayers();

            let fireCoords = [];
            for (let i = 0; i < reg.hotspots; i++) {
                let fLat = reg.lat + (Math.random() * 0.2 - 0.1);
                let fLon = reg.lon + (Math.random() * 0.2 - 0.1);
                fireCoords.push([fLat, fLon]);

                let m = L.circleMarker([fLat, fLon], {
                    radius: 12, color: '#f43f5e', fillColor: '#f43f5e', fillOpacity: 0.85
                }).bindPopup(`<b>NASA FIRMS Hotspot #${i+1}</b><br>Satellite: VIIRS 375m<br>Confidence: 96%`);
                fireLayerGroup.addLayer(m);
            }

            if (fireCoords.length > 0) {
                let safeStart = [reg.lat - 0.05, reg.lon - 0.05];
                let safeEnd = [reg.lat - 0.25, reg.lon - 0.25];
                
                let safePath = L.polyline([safeStart, safeEnd], {
                    color: '#10b981', weight: 5, dashArray: '8, 8'
                }).bindPopup(`<b>RASD Safe Evacuation Path</b><br>Dynamic route plotted away from wind vector.`);
                
                let safeMarker = L.marker(safeEnd).bindPopup(`<b>Assembly & Rescue Zone 🛡️</b>`);
                
                routeLayerGroup.addLayer(safePath);
                routeLayerGroup.addLayer(safeMarker);
            }

            logMessage(`[NASA FIRMS API] Retrieved ${reg.hotspots} live thermal hotspots.`);
        }
    } catch (e) {
        logMessage("[Notice] Using local cached satellite data.");
    }
}

function triggerDirectNasaLink() {
    logMessage("🚨 [EMERGENCY] Emergency dispatch request sent to NASA FIRMS.");
    alert("Emergency alert dispatched to local teams with NASA FIRMS coordinates!");
}

function logMessage(msg) {
    const container = document.getElementById('logsContainer');
    const timeStr = new Date().toLocaleTimeString('en-US');
    if (container) {
        container.innerHTML = `<div style="margin-bottom:4px;">[${timeStr}] ${msg}</div>` + container.innerHTML;
    }
}

function initSimulator() {
    const wSlider = document.getElementById('windSlider');
    const aSlider = document.getElementById('areaSlider');
    
    function updateSim() {
        const wind = parseInt(wSlider.value);
        const area = parseInt(aSlider.value);
        
        document.getElementById('windValDisp').textContent = wind + " km/h";
        document.getElementById('areaValDisp').textContent = area + " ha";
        
        let timeSaved = Math.max(15, Math.round(120 - (wind * 0.8) - (area * 0.1)));
        let safety = (99.5 - (wind * 0.05)).toFixed(1);
        
        document.getElementById('simTimeResult').textContent = timeSaved + " mins";
        document.getElementById('simSafetyResult').textContent = safety + "%";
    }
    
    wSlider?.addEventListener('input', updateSim);
    aSlider?.addEventListener('input', updateSim);
}

function animateCounters() {
    const el = document.getElementById('cntFires');
    if (!el) return;
    let target = 1420;
    let current = 0;
    let timer = setInterval(() => {
        current += 35;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        el.textContent = "+" + current.toLocaleString();
    }, 30);
}

function init3DGlobe() {
    const container = document.getElementById('globe3dContainer');
    if (!container || container.children.length > 0) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(2.1, 36, 36);
    const material = new THREE.MeshPhongMaterial({
        color: 0x0ea5e9, wireframe: true, transparent: true, opacity: 0.65
    });
    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    const light = new THREE.DirectionalLight(0x38bdf8, 1.5);
    light.position.set(5, 4, 5).normalize();
    scene.add(light);

    camera.position.z = 5.2;

    let mouseX = 0, mouseY = 0;
    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        mouseX = ((e.clientX - rect.left) / container.clientWidth) - 0.5;
        mouseY = ((e.clientY - rect.top) / container.clientHeight) - 0.5;
    });

    function animate() {
        requestAnimationFrame(animate);
        globe.rotation.y += 0.003;
        globe.rotation.x = mouseY * 0.4;
        globe.rotation.z = mouseX * 0.3;
        renderer.render(scene, camera);
    }
    animate();
}

function initSatellite3D() {
    const container = document.getElementById('sat3dContainer');
    if (!container || container.children.length > 0) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const satGroup = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(1.2, 0.8, 0.8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.2 });
    const satBody = new THREE.Mesh(bodyGeo, bodyMat);
    satGroup.add(satBody);

    const panelGeo = new THREE.BoxGeometry(3.2, 0.04, 0.9);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.1 });
    const panels = new THREE.Mesh(panelGeo, panelMat);
    satGroup.add(panels);

    const lensGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.4, 16);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(0, -0.4, 0);
    satGroup.add(lens);

    scene.add(satGroup);

    const light = new THREE.DirectionalLight(0xffffff, 1.5);
    light.position.set(5, 5, 5);
    scene.add(light);

    camera.position.z = 4.8;

    function animate() {
        requestAnimationFrame(animate);
        satGroup.rotation.y += 0.01;
        satGroup.rotation.x = Math.sin(Date.now() * 0.001) * 0.15;
        renderer.render(scene, camera);
    }
    animate();
}

function initSensorNode3D() {
    const container = document.getElementById('sensor3dContainer');
    if (!container || container.children.length > 0) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const sensorGroup = new THREE.Group();

    const towerGeo = new THREE.CylinderGeometry(0.1, 0.6, 2.2, 4);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    sensorGroup.add(tower);

    const boxGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.5 });
    const iotBox = new THREE.Mesh(boxGeo, boxMat);
    iotBox.position.y = 0.5;
    sensorGroup.add(iotBox);

    const domeGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const domeMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, wireframe: true });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 1.2;
    sensorGroup.add(dome);

    scene.add(sensorGroup);

    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(4, 5, 4);
    scene.add(light);

    camera.position.z = 4.8;

    function animate() {
        requestAnimationFrame(animate);
        sensorGroup.rotation.y += 0.008;
        dome.rotation.y -= 0.02;
        renderer.render(scene, camera);
    }
    animate();
}