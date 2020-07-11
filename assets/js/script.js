// Simple obfuscation to prevent scraping - key is scrambled here and then reassembled in code.
const bingFragments = [ "Anhz", "u3sc", "lddW", "XySE", "_-mD", "47H8", "2t3i", "GAHV", "uUrv", "6zb1", "QY5f", "_m2a", "Y-df", "-5A2", "lzMb", "8FyP" ];
const zipFragments = [ "5fMZ", "uis6", "biA4", "ZNwR", "9h1q", "ZKEC", "nEdI", "Up8D", "Eaiq", "OyJG", "UPNU", "r7eG", "ri8E", "MCxz", "EloA", "75Qa" ];

const stateLookup = { AL: "Alabama", AK: "Alaska", AS: "American Samoa", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", GU: "Guam", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", MP: "North Mariana Is", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", PR: "Puerto Rico", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", VI: "Virgin Islands", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming"};

const breweryIconDefault = "./assets/images/pin.png";
const breweryIconFavorite = "./assets/images/favorite.png";
const breweryIconVisited = "./assets/images/visited.png";
const breweryIconRoute = "./assets/images/star.png"

var breweryList = $("#breweryList");
var favoriteList = JSON.parse(localStorage.getItem("hopToFavorites")) || [];
var visitedList = JSON.parse(localStorage.getItem("hopToVisited")) || [];

var map // Microsoft map object.
var breweryData = [];


// Handler for the Search button
var searchCityState = function(event) {
	event.preventDefault();
	var cityName = $("#byCity").val();
	var stateName = $("#byState").val();

	var fetchUrl = "https://api.openbrewerydb.org/breweries?";

	if (cityName) {
		fetchUrl += "by_city=" + cityName.toLowerCase() + "&";
	}

	if ((stateName) && (stateName != "State")) {
		fetchUrl += "by_state=" + stateName.toLowerCase() + "&";
	} else if (!cityName) {
		$('#noCityState').removeClass('hide'); //Display Alert
		return;
	}

	if ($('#noCityState').attr('class') != 'cell small-12 callout alert small flex-container align-justify align-middle hide') {
		$('#noCityState').addClass('hide');
	} // If alert is triggered this hides it after succesful search

	fetch(fetchUrl + "per_page=50").then(function (response) {

		if (response.ok) {
			// TODO - How to deal with paginated results?  I'd like to combine them into a single large list.
			response.json().then(processBreweryData);
		}
		else {
			breweryData = []; // Clear old data.
			// TODO - Display an error message!
			console.log("ERROR ACCESSING BREWERY API!")
		}		
	})
}

//Search for breweries by radius from given ZIP
var searchZipRadius = function(event){
    event.preventDefault();
    var buildKeyZIP = "";
    var buildKeyMaps = "";
    var radius = $("#distanceOption").val();
    for (var i = 0; i < zipFragments.length; i++) {
        buildKeyZIP += zipFragments[(13 * i) % zipFragments.length];
    }
    for (var i = 0; i < bingFragments.length; i++) {
        buildKeyMaps += bingFragments[(13 * i) % bingFragments.length];
    }
    var chosenZIP = $("#distanceZip").val();
    //api url... ASSEMBLE!!!!
    var zipSearchURL = "https://www.zipcodeapi.com/rest/" + buildKeyZIP + "/radius.json/" 
        + chosenZIP.toString() + "/" + radius.toString() + "/mile"
    //console.log(radius, zipSearchURL);
    // https://www.zipcodeapi.com/rest/<api_key>/radius.<format>/<zip_code>/<distance>/<units>

    fetch(zipSearchURL, { mode: 'cors' }).then(function (response) {
        console.dir(response);
        if (response.ok) {
            response.json().then(function(data){
    // TODO remove the following line. This was used to fudge the API fetch in pre-production env.
                //console.dir(data);
                var numCitiesNearby = data.zip_codes.length;
                var openBreweryDBAPIFetchURLs = [];
                // source of following inline function to sort by distance https://stackoverflow.com/a/1129270
                data.zip_codes.sort((a, b) => (a.distance > b.distance) ? 1 : ((b.distance > a.distance) ? -1 : 0));
                for(var i = 0; i < numCitiesNearby; i++){
                    openBreweryDBAPIFetchURLs.push("https://api.openbrewerydb.org/breweries?by_postal=" + data.zip_codes[i].zip_code);
                }

                //promise.all example borrowed from https://gomakethings.com/waiting-for-multiple-all-api-responses-to-complete-with-the-vanilla-js-promise.all-method/
                Promise.all(openBreweryDBAPIFetchURLs.map(x=>fetch(x))).then(function (responses) {
                    // Get a JSON object from each of the responses
                    return Promise.all(responses.map(function (response) {
                        return response.json();
                    }));
                }).then(function (data) {
                    var breweryList = [];
                    for (var i = 0; i < numCitiesNearby; i++){
                        if(data[i].length > 0 ){
                            data[i].forEach(value => breweryList.push(value));
                        }
                    }
                    console.log(breweryList)
                }).catch(function (error) {
                    // if there's an error, log it
                    console.log(error);
                });
                        })
                    }

                })
    // TODO on error 404, may not be valid zip
}

var processFavoriteClick = function() {
	var currentCB = $(this);
	setBreweryFavorite(currentCB.attr("data-index"), currentCB.prop("checked"));
}

var processVisitedClick = function() {
	var currentCB = $(this);
	setBreweryVisited(currentCB.attr("data-index"), currentCB.prop("checked"));
}

// Processes returned brewery data.
var processBreweryData = function(data) {
	breweryData = data;

	breweryData.sort(function(a, b) {
		return a.name.localeCompare(b.name);
	});

	breweryList.text(""); // Clear previous results.

	for (var i = 0; i < breweryData.length; i++) {

		if ((breweryData[i].street) && (breweryData[i].brewery_type != "planning")) {
			// If we don't have location info, get it from Bing!
			if ((!breweryData[i].latitude) || (!breweryData[i].longitude)) {
				getLatitudeLongitude(i, true);
			}
		} else {
			breweryData.splice(i, 1);
			i--; // There is now a new item at our current position, pull the list counter back by one so it gets processed.
		}
	}

	displayBreweryData();
}

// Helper function - Retrieve missing lat/lon for brewery at the given index in our data.
var getLatitudeLongitude = function(idx, updateMapBounds=false) {
	var buildKey = "";

	for (var i = 0; i < bingFragments.length; i++) {
		buildKey += bingFragments[(13 * i) % bingFragments.length];
	}

	fetch(
		"http://dev.virtualearth.net/REST/v1/Locations/US/" + breweryData[idx].state.trim() + "/" + breweryData[idx].postal_code.trim() + "/" + breweryData[idx].city.trim() + "/" + breweryData[idx].street.trim() + "?key=" + buildKey
	).then(function (response) {
		if (response.ok) {
			response.json().then(function (tmpData) {
				if (tmpData.resourceSets[0].resources[0].point.coordinates) {
					breweryData[idx].latitude = tmpData.resourceSets[0].resources[0].point.coordinates[0];
					breweryData[idx].longitude = tmpData.resourceSets[0].resources[0].point.coordinates[1];
				}

				createMapPin(idx);

				if ((updateMapBounds) && (map)) {
					calculateMapBounds();
				}
			});
		}
	})
}

// Displays our current brewery data to the screen.
var displayBreweryData = function() {
	var displayIndex = 0;

	if (breweryData.length === 0) {
		console.log('nothing here');
		$('#noBrewery').removeClass('hide');
		breweryList.append(
			"<li style='border: none; color: rgb(180, 180, 180); background-color: rgb(230, 230, 230, 0.1); height:50vh;' class='flex-container align-middle align-center'>"
			+ "There Doesn't Seem to Be Any Breweries Here.</li>"
		); 
		return;
	}

	if ($('#noBrewery').attr('class') != 'cell small-12 callout alert small flex-container align-justify align-middle hide') {
		$('#noBrewery').addClass('hide');
	} // If alert is triggered this hides it after succesful search

	// Make sure output is visible.
	$("#breweryList").removeClass("hide");
	$("#mapDisplay").removeClass("hide");
	$("#mapToggle").removeClass("hide");

	breweryList.text("");

	for (var i = 0; i < breweryData.length; i++) {
		if (breweryMeetsFilters(i)) {
			breweryList.append(
				"<li class='list-group-item flex-container align-justify align-middle brewery-list-item'>" +
					"<div>" + (displayIndex + 1) +"</div>" +
					"<div>" +
						"<strong>" + "<a>" + breweryData[i].name + "</a></strong>" +
						"<p class='subheader'>" + breweryData[i].street + ", " + breweryData[i].city + "</p>" +
					"</div>" +
					"<div class='flex-container'>" +
						"<div class='checkbox'>" +
							"<input data-index='" + displayIndex + "' class='checkbox-element' type='checkbox'  name='favorite'" + ((favoriteList.indexOf(breweryData[i].id) > -1) ? "checked" : "") + ">" +
							"<i class='foundicon-heart'></i>" +
						"</div>" +
						"<div class='checkbox'>" +
							"<input data-index='" + displayIndex + "' class='checkbox-element' type='checkbox' name='visited'" + ((visitedList.indexOf(breweryData[i].id) > -1) ? "checked" : "") + ">" +
							"<i class='foundicon-checkmark'></i>" +
						"</div>" +
					"</div>" +
				"</li>"
			);

			breweryData[i].displayIndex = displayIndex++;
		} else {
			breweryData[i].displayIndex = null;
		}
	}

	refreshMap();
}

// Helper function used to check current brewer against filters.
// Logic in here only looks for reasons to disqualify, if we make it to the end it returns true by default.
var breweryMeetsFilters = function(idx) {
	var filterMicro = $("#microFilter").prop("checked");
	var filterRegional = $("#regionalFilter").prop("checked");
	var filterBrewpub = $("#brewpubFilter").prop("checked");
	var filterLarge = $("#largeFilter").prop("checked");
	
	// Only check type filters if one is active.
	if (filterMicro || filterRegional || filterBrewpub || filterLarge) {
		switch (breweryData[idx].brewery_type) {
			case "micro":
				if (!filterMicro) {
					return false;
				}
				break;
			case "regional":
				if (!filterRegional) {
					return false;
				}
				break;
			case "brewpub":
				if (!filterBrewpub) {
					return false;
				}
				break;
			case "large":
				if (!filterLarge) {
					return false;
				}
				break;
		}
	}

	// Visited filter.
	if (($("#visitedFilter").prop("checked")) && (visitedList.indexOf(breweryData[idx].id) < 0)) {
		return false;
	} else if (($("#unvisitedFilter").prop("checked")) && (visitedList.indexOf(breweryData[idx].id) > -1)) {
		return false;
	}

	// Favorites filter.
	if (($("#favoritesFilter").prop("checked")) && (favoriteList.indexOf(breweryData[idx].id) < 0)) {
		return false;
	}

	return true;
}

// Resets the map widget.
var refreshMap = function() {
	var pin;

	// If we already have a map, clear all markers.  Otherwise, make the map.
	if (map) {
		map.entities.clear();
	}
	else {
		map = new Microsoft.Maps.Map("#mapDisplay");
	}

	for (var i = 0; i < breweryData.length; i++) {
		if ((breweryData[i].latitude) && (breweryData[i].longitude)) {
			createMapPin(i);
		}
	}

	calculateMapBounds();
}

// Change the viewing area for the map.
// Called when pins are added, but also as getLatitudeLongitude calls come in.
var calculateMapBounds = function() {
	var doSet = false;
	var locs = [];

	for (var i = 0; i < breweryData.length; i++) {
		if (breweryData[i].pin) {
			locs.push(breweryData[i].pin.getLocation());
			doSet = true;
		}
	}

	if (doSet) {
		map.setView({ bounds: Microsoft.Maps.LocationRect.fromLocations(locs), padding: 80 });
	}
}

// Creates a map pin for the brewery at the specified index.
// This is in its own function because it can be used by getLatitudeLongitude or refreshMap.
var createMapPin = function(idx) {
	// Don't make a pin if this brewery isn't set to display.
	if (breweryData[idx].displayIndex == null) {
		return;
	}

	if (!breweryData[idx].pin) {
		var icon;

		if (favoriteList.indexOf(breweryData[idx].id) > -1) {
			icon = breweryIconFavorite;
		} else if (visitedList.indexOf(breweryData[idx].id) > -1) {
			icon = breweryIconVisited;
		} else {
			icon = breweryIconDefault;
		}

		var loc = new Microsoft.Maps.Location(breweryData[idx].latitude, breweryData[idx].longitude);
		pin = new Microsoft.Maps.Pushpin(loc, {
			title: breweryData[idx].name,
			text: (breweryData[idx].displayIndex + 1).toString(),
			icon: icon
		});

		breweryData[idx].pin = pin; // Save our pin so we can manipulate it later.
	} else {
		breweryData[idx].pin.setOptions({text: (breweryData[idx].displayIndex + 1).toString()});
	}

	if (breweryMeetsFilters(idx)) {
		if (map.entities.indexOf(breweryData[idx].pin) < 0) {
			map.entities.push(breweryData[idx].pin);
		}
	} else if (map.entities.indexOf(breweryData[idx].pin > -1)) {
		map.entities.remove(breweryData[idx].pin)
	}
}

var setBreweryFavorite = function(idx, favorite) {
	var curBrewery = breweryData[getDisplayedBrewery(idx)];

	if (favorite) {
		curBrewery.pin.setOptions({icon: breweryIconFavorite});

		if (favoriteList.indexOf(curBrewery.id) < 0) {
			favoriteList.push(curBrewery.id);
		}
	} else {
		var icon = (visitedList.indexOf(curBrewery.id) < 0) ? breweryIconDefault : breweryIconVisited;
		curBrewery.pin.setOptions({icon: icon});

		var findMe = favoriteList.indexOf(curBrewery.id);

		if (findMe > -1) {
			favoriteList.splice(findMe, 1);
		}
	}

	localStorage.setItem("hopToFavorites", JSON.stringify(favoriteList));
}

var setBreweryVisited = function(idx, visited) {
	var curBrewery = breweryData[getDisplayedBrewery(idx)];

	if (visited) {
		if (favoriteList.indexOf(curBrewery.id) < 0) { // Only change color if not already favorited.
			curBrewery.pin.setOptions({icon: breweryIconVisited});
		}

		if (visitedList.indexOf(curBrewery.id) < 0) {
			visitedList.push(curBrewery.id);
		}
	} else {
		if (favoriteList.indexOf(curBrewery.id) < 0) { // Only change color if not already favorited.
			curBrewery.pin.setOptions({icon: breweryIconDefault});
		}

		var findMe = visitedList.indexOf(curBrewery.id);

		if (findMe > -1) {
			visitedList.splice(findMe, 1);
		}
	}

	localStorage.setItem("hopToVisited", JSON.stringify(visitedList));
}

// Utility function to get breweryData index based on displayIndex
var getDisplayedBrewery = function(idx) {
	return breweryData.findIndex((element) => element.displayIndex == idx);
}

// Assembles our Bing key and adds the necessary JS reference.
var initialize = function() {
	var buildKey = "";

	for (var i = 0; i < bingFragments.length; i++) {
		buildKey += bingFragments[(13 * i) % bingFragments.length];
	}

	var scriptEl = document.createElement("script");
	scriptEl.setAttribute("type", "text/javascript");
	scriptEl.setAttribute("src", "http://www.bing.com/api/maps/mapcontrol?callback=refreshMap&key=" + buildKey);
	scriptEl.setAttribute("async", "");
	scriptEl.setAttribute("defer", "");
	document.head.appendChild(scriptEl);

	if (navigator.geolocation)
	{
		navigator.geolocation.getCurrentPosition((position) => 
		{
			fetch(
				"http://dev.virtualearth.net/REST/v1/Locations/" + position.coords.latitude + "," + position.coords.longitude + "?key=" + buildKey
			).then(function (response) {
				if (response.ok) {
					response.json().then(function (data) {
						// Weirdly, the city doesn't get its own field in the response, so we'll extract it from the full address.
						// Estimated street address is in data.resourceSets[0].resources[0].address.addressLine
						// Formatted address looks like: "123 Easy St, Anytown, WI 54799"
						var addressParts = data.resourceSets[0].resources[0].address.formattedAddress.split(",");

						$("#byCity").val(addressParts[1].trim());
						$("#distanceZip").val(data.resourceSets[0].resources[0].address.postalCode);

						if (data.resourceSets[0].resources[0].address.adminDistrict in stateLookup) {
							$("#byState").val(stateLookup[data.resourceSets[0].resources[0].address.adminDistrict]);
						}
					});
				}
			});
		});
	}
}

initialize();
$(document).foundation();

$("#searchCityState").on("click", searchCityState);
$("#searchZipRadius").on("click", searchZipRadius);
$("#filterBy").on("click", "input", displayBreweryData);
$("#breweryList").on("click", "input[name='favorite']", processFavoriteClick);
$("#breweryList").on("click", "input[name='visited']", processVisitedClick);

