class LocationTracker {
    constructor() {
        this.tracking = false;
        this.map = null;
        this.marker = null;
        this.path = null;
        this.positions = [];
        this.startTime = null;
        this.trackingInterval = null;
        this.showPath = true;

        // First check if geolocation is supported
        if (!navigator.geolocation) {
            this.showError("Geolocation is not supported by your browser");
            return;
        }

        this.initializeMap();
        this.setupEventListeners();
        this.checkInitialPermission(); // Check permission on load

        // Add IP tracking properties
        this.ipMarker = null;
        this.ipLocationInfo = null;
    }

    async checkInitialPermission() {
        try {
            // First try to get the current position to trigger permission prompt
            await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    position => {
                        // If we get here, we have permission
                        this.handlePosition(position);
                        resolve(position);
                    },
                    error => {
                        console.log("Initial position check error:", error);
                        reject(error);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 5000,
                        maximumAge: 0
                    }
                );
            });

            // Update UI to show we have permission
            document.getElementById('statusText').textContent = 'Ready';
            document.getElementById('statusIndicator').classList.remove('offline');
            document.getElementById('statusIndicator').classList.add('ready');
            document.getElementById('startTracking').disabled = false;

        } catch (error) {
            // Handle the error based on the error code
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    this.showError("Location access denied. Please enable location services in your browser settings.");
                    break;
                case error.POSITION_UNAVAILABLE:
                    this.showError("Location information is unavailable. Please check your device's GPS.");
                    break;
                case error.TIMEOUT:
                    this.showError("Location request timed out. Please check your internet connection.");
                    break;
                default:
                    this.showError("An unknown error occurred while getting location.");
            }
            
            document.getElementById('statusText').textContent = 'Permission Denied';
            document.getElementById('startTracking').disabled = true;
        }
    }

    initializeMap() {
        // Initialize map with default view of the world
        this.map = L.map('map').setView([0, 0], 2);
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Initialize polyline for path
        this.path = L.polyline([], {
            color: '#2196F3',
            weight: 4
        }).addTo(this.map);
    }

    setupEventListeners() {
        document.getElementById('startTracking').addEventListener('click', () => {
            this.startTracking();
        });

        document.getElementById('stopTracking').addEventListener('click', () => {
            this.stopTracking();
        });

        document.getElementById('centerMap').addEventListener('click', () => {
            this.centerMap();
        });

        document.getElementById('togglePath').addEventListener('click', () => {
            this.togglePath();
        });

        // Add IP tracking event listener
        document.getElementById('trackIP').addEventListener('click', () => {
            this.trackIPAddress();
        });
    }

    async startTracking() {
        try {
            // Request a position first to ensure we have permission
            await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                });
            });

            this.tracking = true;
            this.startTime = new Date();
            this.positions = [];
            this.updateUI(true);
            this.track();

            // Start interval for continuous tracking
            this.trackingInterval = setInterval(() => this.track(), 5000);

        } catch (error) {
            this.showError('Failed to start tracking. Please check your location permissions.');
            this.updateUI(false);
        }
    }

    stopTracking() {
        this.tracking = false;
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }
        this.updateUI(false);
    }

    track() {
        if (!this.tracking) return;

        navigator.geolocation.getCurrentPosition(
            position => this.handlePosition(position),
            error => this.handleError(error),
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    }

    handlePosition(position) {
        const { latitude, longitude, accuracy, altitude, speed } = position.coords;
        
        // Update positions array
        this.positions.push([latitude, longitude]);

        // Update marker
        if (!this.marker) {
            this.marker = L.marker([latitude, longitude]).addTo(this.map);
            // Add accuracy circle
            this.accuracyCircle = L.circle([latitude, longitude], {
                radius: accuracy,
                color: '#4CAF50',
                fillColor: '#4CAF50',
                fillOpacity: 0.1
            }).addTo(this.map);
        } else {
            this.marker.setLatLng([latitude, longitude]);
            this.accuracyCircle.setLatLng([latitude, longitude]);
            this.accuracyCircle.setRadius(accuracy);
        }

        // Update path
        if (this.showPath) {
            this.path.setLatLngs(this.positions);
        }

        // Update info display
        this.updateLocationInfo({
            latitude,
            longitude,
            accuracy,
            altitude,
            speed
        });

        // Center map on first position or if tracking is active
        if (this.positions.length === 1 || this.tracking) {
            this.map.setView([latitude, longitude], 15);
        }
    }

    handleError(error) {
        console.error('Location error:', error);
        this.stopTracking();
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                this.showError("Location access was denied. Please enable location services.");
                break;
            case error.POSITION_UNAVAILABLE:
                this.showError("Location information is unavailable.");
                break;
            case error.TIMEOUT:
                this.showError("Location request timed out.");
                break;
            default:
                this.showError("An unknown error occurred while getting location.");
        }
    }

    updateLocationInfo(data) {
        const locationInfo = document.getElementById('locationInfo');
        locationInfo.innerHTML = `
            <p><strong>Latitude:</strong> ${data.latitude.toFixed(6)}°</p>
            <p><strong>Longitude:</strong> ${data.longitude.toFixed(6)}°</p>
            <p><strong>Accuracy:</strong> ${Math.round(data.accuracy)} meters</p>
            ${data.altitude ? `<p><strong>Altitude:</strong> ${Math.round(data.altitude)} meters</p>` : ''}
            ${data.speed ? `<p><strong>Speed:</strong> ${Math.round(data.speed * 3.6)} km/h</p>` : ''}
        `;

        this.updateTrackingStats();
    }

    updateTrackingStats() {
        if (!this.startTime) return;

        const duration = new Date() - this.startTime;
        const hours = Math.floor(duration / 3600000);
        const minutes = Math.floor((duration % 3600000) / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);

        document.getElementById('duration').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('pointsCount').textContent = this.positions.length;
    }

    updateUI(tracking) {
        const startBtn = document.getElementById('startTracking');
        const stopBtn = document.getElementById('stopTracking');
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');

        startBtn.disabled = tracking;
        stopBtn.disabled = !tracking;
        
        if (tracking) {
            statusIndicator.classList.remove('offline', 'ready');
            statusIndicator.classList.add('online');
            statusText.textContent = 'Tracking';
        } else {
            statusIndicator.classList.remove('online');
            statusIndicator.classList.add('ready');
            statusText.textContent = 'Ready';
        }
    }

    centerMap() {
        if (this.marker) {
            this.map.setView(this.marker.getLatLng(), 15);
        }
    }

    togglePath() {
        this.showPath = !this.showPath;
        if (this.showPath) {
            this.path.setLatLngs(this.positions);
        } else {
            this.path.setLatLngs([]);
        }
    }

    showError(message) {
        alert(message);
    }

    async trackIPAddress() {
        const ipInput = document.getElementById('ipAddress').value;
        
        // Basic IP address validation
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(ipInput)) {
            this.showError('Please enter a valid IP address');
            return;
        }

        try {
            console.log(`Fetching location for IP: ${ipInput}`); // Log the IP being fetched
            const response = await fetch(`https://ipapi.co/${ipInput}/json/`);
            
            // Check if the response is ok (status in the range 200-299)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(data.reason || 'Invalid IP address');
            }

            this.displayIPLocation(data);
        } catch (error) {
            console.error(`Error occurred: ${error.message}`); // Log the error message
            this.showError(`Failed to track IP: ${error.message}`);
        }
    }

    displayIPLocation(data) {
        const { latitude, longitude, city, region, country_name, ip } = data;

        // Update IP marker on map
        if (this.ipMarker) {
            this.ipMarker.remove();
        }

        this.ipMarker = L.marker([latitude, longitude], {
            icon: L.divIcon({
                className: 'ip-marker',
                html: '<i class="fas fa-desktop"></i>',
                iconSize: [30, 30]
            })
        }).addTo(this.map);

        // Add popup to marker
        this.ipMarker.bindPopup(`
            <strong>IP Address:</strong> ${ip}<br>
            <strong>Location:</strong> ${city}, ${region}, ${country_name}<br>
            <strong>Coordinates:</strong> ${latitude}, ${longitude}
        `).openPopup();

        // Center map on IP location
        this.map.setView([latitude, longitude], 13);

        // Update IP tracking info panel
        document.getElementById('ipTrackingInfo').innerHTML = `
            <h4>IP Location Details</h4>
            <p><strong>IP Address:</strong> ${ip}</p>
            <p><strong>City:</strong> ${city}</p>
            <p><strong>Region:</strong> ${region}</p>
            <p><strong>Country:</strong> ${country_name}</p>
            <p><strong>Latitude:</strong> ${latitude}</p>
            <p><strong>Longitude:</strong> ${longitude}</p>
        `;
    }
}

// Initialize the application
window.onload = () => {
    const tracker = new LocationTracker();
}; 
