const Model = (function() {
    // *** AUTO-COMPLETE CONFIG *** //
    const placesAutocomplete = places({
        appId: 'Paster your Algolia App ID here',
        apiKey: 'Paste your Algolia API key here',
        countries: ['gb'],
        type: 'city',
        hitsPerPage: 6,
        container: document.querySelector('#auto-search')
    });
    // **************************** //

    // *** API KEYS *** //
    const geoCodeKey = 'Paste your MapQuest API key here';
    const weatherKey = 'Paste your DarkSky API key here';
    // **************************** //


    const weatherData = {
        current: {},
        week: []
    };

    const rewriteState = (type, data) => {                     // Get current weather state, either UI friendly or for icon import
        let format;
        type === 'heading' ? format = 1 : format = 0;

        const state = {
            'clear-day': ['sun', 'Sunny'],
            'clear-night': ['clear', 'Clear'],
            'partly-cloudy-day': ['cloud-sun', 'Partly Cloudy'],
            'partly-cloudy-night': ['partly-cloudy', 'Partly Cloudy'],
            'cloudy': ['cloud', 'Cloudy'],
            'rain': ['cloud-rain', 'Rain'],
            'snow': ['snowflake', 'Snow'],
            'wind': ['wind', 'Windy'],
            'fog': ['smog', 'Fog'],
            'sleet': ['bolt', 'Storms'],
            'default': ['cloud', 'Cloudy']
        };

        return state.hasOwnProperty(data) ? state[data][format] : state['default'][0];
    }

    const populateWeatherData = resData => {
        // Add todays data to data object
        weatherData.image = resData.data.currently.icon;
        weatherData.current.state = rewriteState('heading', resData.data.currently.icon);
        weatherData.current.temp = `${Math.round(resData.data.currently.temperature)}°`;
        weatherData.current.tempHi = `${Math.round(resData.data.daily.data[0].temperatureHigh)}°`;
        weatherData.current.tempLo = `${Math.round(resData.data.daily.data[0].temperatureLow)}°`;

        // Add next 5 days data to data object
        const weekData = resData.data.daily.data.slice(1,6);
        const dayNames = getDayNames();
        
        for (let i=0; i<weekData.length; i++) {
            // Create array
            const weekDay = [];

            // Populate array
            weekDay.push(dayNames[i]);
            weekDay.push(`<i class="fas fa-${rewriteState('icon', weekData[i].icon)}"></i>`);
            weekDay.push(`${calcAverage(weekData[i].temperatureHigh, weekData[i].temperatureLow)}°`);
            weekDay.push(`${Math.round(weekData[i].temperatureHigh)}°/`);
            weekDay.push(`${Math.round(weekData[i].temperatureLow)}°`);
            
            // Add to data object
            weatherData.week.push(weekDay);
        }
    }

    const getDayNames = () => {
        let result = [];
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // Get today
        const d = new Date();
        const today = d.getDay();   // 4

        // Number of following days to get
        const numOfDays = 5;

        // Get the next 5 day names from array, not including today
        for (let i = 1; i < numOfDays + 1; i++) {
            result.push(days[(today + i) % days.length]);
        } 

        return result;
    }

    const calcAverage = (a, b) => {
        return Math.round((a + b) / 2);
    }

    const clearWeatherData = () => {
        for (var key in weatherData) {
            if (weatherData.hasOwnProperty(key)) {
                delete weatherData[key];
            }
        }
    }

    return {
        getCoordsFromString: async function(query) {
            try {
                weatherData.current.location = query;
                const res = await axios(`https://cors-anywhere.herokuapp.com/https://www.mapquestapi.com/geocoding/v1/address?key=${geoCodeKey}&location=${query},%GB`);
                const coords = res.data.results[0].locations[0].latLng;
                return coords;
            } catch(err) {
                
                clearWeatherData();
                return {
                    errMsg: 'Unable to find your results.<br>Please try again with a UK place name or try the "Use my location" button'
                }
            }
        },

        getGeoLocation: () => {
            return new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve,reject);
            });
        },

        getPlaceNameFromCoords: async function(coords) {
            try {
                const res = await axios(`https://cors-anywhere.herokuapp.com/https://www.mapquestapi.com/geocoding/v1/reverse?key=${geoCodeKey}&location=${coords.lat},${coords.lng}`);
                weatherData.current.location = res.data.results[0].locations[0].adminArea5;
            }
            catch(err) {
                return err;
            }
        },

        getWeatherData: async function(coords) {
            try {
                const res = await axios(`https://cors-anywhere.herokuapp.com/https://api.darksky.net/forecast/${weatherKey}/${coords.lat},${coords.lng}?units=si&exclude=minutely,hourly,flags,alerts`);

                populateWeatherData(res);
                return weatherData;
            } catch(err) {
                
                clearWeatherData();
                return {
                    errMsg: 'Unable to find your results.<br>Please try again with a UK place name or alter your query'
                }
            }
        },

        emptyDataObject: () => {
            for (var prop in weatherData) { 
                if (weatherData.hasOwnProperty(prop)) {
                    delete weatherData[prop]; 
                } 
            }
            weatherData.current = {};
            weatherData.week = [];
        }
    }

})();

const UI = (function() {
    // *** GLOBAL DOM *** //
    const searchContainer = document.querySelector('.search__container');
    const resultsContainer = document.querySelector('.results__container');
    const resetBtn = document.querySelector('.results__reset');
    const errBox = document.querySelector('.err');
    const errContent = document.querySelector('.err__content');
    const errMsg = document.querySelector('.err__msg');
    const animationDelay = 300;

    // *** SEARCH DOM *** //
    const search = {
        content: document.querySelector('.search'),
        input: document.querySelector('.search__form__input'),
        searchButton: document.querySelector('.search__form__btn'),
        locationButton: document.querySelector('.search__location__btn'),
        loader: document.querySelector('.loader')
    };

    // *** RESULTS DOM *** //
    const results = {
        image: document.querySelector('.results__bg-image'),
        current: {
            location: document.querySelector('.results__current__location'),
            state: document.querySelector('.results__current__state'),
            temp: document.querySelector('.results__current__temp--temp'),
            tempHi: document.querySelector('.results__current__hi__content'),
            tempLo: document.querySelector('.results__current__lo__content')
        },
        week: {
            day: Array.from(document.querySelectorAll('.week__day')),
            icon: Array.from(document.querySelectorAll('.week__icon')),
            temp: Array.from(document.querySelectorAll('.week__temp')),
            hi: Array.from(document.querySelectorAll('.week__range__hi')),
            lo: Array.from(document.querySelectorAll('.week__range__lo'))
        }
    };

    const sanitizeInput = input => {
        // Check that all chars match letter, whitespace or hyphen
        if (input.match(/^[a-zA-Z.\-_\s]+$/)) { 
            return input;
        } else {
            return false;
        }
    };

    const smoothCenter = el => {
        setTimeout(() => {
            el.classList.toggle('center');
        }, 300);
    }

    const showElement = (el, delay = 300) => {
        el.classList.add('display');
        setTimeout(() => {
            el.classList.add('show');
        }, delay);
    };

    const hideElement = (el, delay = 300) => {
        el.classList.remove('show');
        setTimeout(() => {
            el.classList.remove('display');
        }, delay);
    };

    const removeErrMsg = () => {
        smoothCenter(errContent);
        hideElement(errBox);
        search.input.value = "";

        setTimeout(() => {
            errMsg.textContent = "";
        }, animationDelay);
    };

    const resizeFont = el => {
        const heightLimit = 120;         // Element height limit
        const theSize = getComputedStyle(el).getPropertyValue('font-size').replace("px", ""); // Get font size without 'px'
        let newFSize = theSize;  

        while (el.offsetHeight > heightLimit) {
            newFSize--;
            el.style.fontSize = `${newFSize}px`;
        }

    };

    return {
        getSearchInput: function() {
            // Get value
            const value = search.input.value;

            if (value.length > 1) {
                // Remove county & country from string
                const arr = value.split(',');
                let input = arr[0];
                // Sanitize input
                input = sanitizeInput(input);
    
                // Display Error or return valid string
                if (!input) {
                    this.displayErrMsg('Only alphabetical characters and hyphens allowed');
                    return false;
                } else {
                    return input;
                }
            } else {
                this.displayErrMsg('Please enter a location to search');
            }
        },

        renderResults: (data) => {
            results.image.setAttribute('srcset', `img/${data.image}-l.jpg 2880w, img/${data.image}-m.jpg 2048w, img/${data.image}-s.jpg 750w`);
            results.image.src = `img/${data.image}-m.jpg`;

            for (const key of Object.keys(results.current)) {
                results.current[key].textContent = data.current[key];
            }

            let counter = 0;
            for (const key of Object.keys(results.week)) {              // for all divs by type (day, icon etc.)
                results.week[key].forEach((cur, index) => {             // loop through each
                    cur.innerHTML = data.week[index][counter];        // Append data
                });
                counter++;                                              // Increment external counter (to iterate over individual data arrays)
            }
        },

        displayErrMsg: (msg) => {
            errMsg.innerHTML = msg;
            showElement(errBox);
            // Slide element down to center
            smoothCenter(errContent);
        },

        changeState: (state) => {
            if (state === 'search') {
                removeErrMsg();
                hideElement(search.loader);
                showElement(searchContainer);
                showElement(search.content);
                hideElement(resultsContainer, 1500);

            } else if (state === 'load') {
                hideElement(search.content);
                showElement(search.loader);

            } else if (state === 'results') {
                showElement(resultsContainer, 0);
                hideElement(search.loader);
                hideElement(searchContainer, 1000);
                resizeFont(results.current.location); 
            }
        }
    }

})();


const AppController = (function(Model, UI) {

    const setupEventListeners = () => {
        document.querySelector('.search').addEventListener('click', e => {
            e.preventDefault();

            if (e.target.classList.contains('search__form__btn')) {
                userSearch();
            } else if (e.target.classList.contains('search__location__btn')) {
                locationSearch();
            }
        });

        document.querySelector('.err').addEventListener('click', e => {
            if (e.target.classList.contains('err__btn') || e.target.classList.contains('err__underlay')) {
                UI.changeState('search');
            }
        });

        document.querySelector('.results__reset').addEventListener('click', () => {
            UI.changeState('search');
            Model.emptyDataObject();
        });
    }

    // Search by user input...
    const userSearch = () => {
        // Show load state
        UI.changeState('load');

        // Get search input, slice & sanitize
        const input = UI.getSearchInput();
        
        if (input) {
            // Get coordinates
            const coords = Model.getCoordsFromString(input);
            
            // Get weather data if no errors
            coords.then(data => {
                if (data.hasOwnProperty('errMsg')) {
                    UI.displayErrMsg(data.errMsg);
                } else {
                    getWeather(data);
                }
            });
        }
    };

    // ... or search by geolocation
    const locationSearch = async () => {
        // Show load state
        UI.changeState('load');

        try {
            // Get coords from GeoLocation
            const position =  await Model.getGeoLocation();
            // Format coords
            const coords = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            // Set location name
            Model.getPlaceNameFromCoords(coords);

            getWeather(coords);
            
        }
        catch (err) {
            UI.displayErrMsg('Unable to find your location.<br>Please use the search field above');
        }

    }


    // Weather search for both user methods
    const getWeather = async coords => {
        try {
            // Make api call
            const weatherData = await Model.getWeatherData(coords);

            if (weatherData.hasOwnProperty('errMsg')) {
                UI.displayErrMsg(weatherData.errMsg);
            } else {
                // Render results
                UI.renderResults(weatherData);

                // Change state
                UI.changeState('results');
            }

        } catch (err) {
            UI.displayErrMsg('Unable to fetch you weather.<br>Please try again');
        }

    }

    return {
        init: function() {
            setupEventListeners();
        }
    }
})(Model, UI);

AppController.init();
