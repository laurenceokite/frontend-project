// Simple obfuscation to prevent scraping - key is scrambled here and then reassembled in code.
const bingFragments = ["Anhz", "u3sc", "lddW", "XySE", "_-mD", "47H8", "2t3i", "GAHV", "uUrv", "6zb1", "QY5f", "_m2a", "Y-df", "-5A2", "lzMb", "8FyP"];
const zipFragments = ["js-", "SowV", "q07s", "SnXM", "tHPW", "WVVf", "dP9Q", "A5nQ", "Hzt5", "wuIV", "5lfr", "AhZm", "k2oV", "VcIn", "M5oe", "964W", "x7LI"];

const stateLookup = { AL: "Alabama", AK: "Alaska", AS: "American Samoa", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", GU: "Guam", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", MP: "North Mariana Is", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", PR: "Puerto Rico", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", VI: "Virgin Islands", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };

const breweryIconDefault = "./assets/images/pin.png";
const breweryIconFavorite = "./assets/images/favorite.png";
const breweryIconVisited = "./assets/images/visited.png";
const breweryIconTourSelect = "./assets/images/star.png"

var startingAddress = "";
var startingCity = "";
var startingZip = "";
var startingLat;
var startingLon;

var tourMode = false;
var breweryList = $("#breweryList");
var favoriteList = JSON.parse(localStorage.getItem("hopToFavorites")) || [];
var visitedList = JSON.parse(localStorage.getItem("hopToVisited")) || [];

var map; // Microsoft map object.
var directionsManager; // Microsoft DirectionsManager object.
var breweryData = [];
var tourList = [];


// Handler for the Search button
var searchCityState = function (event) {
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

    var breweryAPIResults = [];

    var getResults = function (pageIndex) {
        fetch(fetchUrl + "per_page=50&page=" + pageIndex).then(function (response) {

            if (response.ok) {
                response.json().then(function (data) {
                    breweryAPIResults.push.apply(breweryAPIResults, data);
                    console.log(breweryAPIResults)
                    if (data.length === 50) {
                        getResults(++pageIndex)
                    }
                    else {
                        processBreweryData(breweryAPIResults);
                    }
                })
            }
            else {
                // TODO - Display an error message! (issue #31)
                console.log("ERROR ACCESSING BREWERY API!")
            }
        })
    }
    getResults(1);
}

//Search for breweries by radius from given ZIP
var searchZipRadius = function (event) {
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
    // API call format: https://www.zipcodeapi.com/rest/<api_key>/radius.<format>/<zip_code>/<distance>/<units>
    fetch(zipSearchURL, { mode: 'cors' }).then(function (response) {
        
        console.dir(response);
        if (response.ok) {
            $("#BadZipCode").addClass("hide");
            console.log("response ok")

            response.json().then(function (data) {
                var numCitiesNearby = data.zip_codes.length;
                var openBreweryDBAPIFetchURLs = [];
                // source of following inline function to sort by distance https://stackoverflow.com/a/1129270
                data.zip_codes.sort((a, b) => (a.distance > b.distance) ? 1 : ((b.distance > a.distance) ? -1 : 0));
                for (var i = 0; i < numCitiesNearby; i++) {
                    openBreweryDBAPIFetchURLs.push("https://api.openbrewerydb.org/breweries?by_postal=" + data.zip_codes[i].zip_code);
                }

                //promise.all example borrowed from https://gomakethings.com/waiting-for-multiple-all-api-responses-to-complete-with-the-vanilla-js-promise.all-method/
                Promise.all(openBreweryDBAPIFetchURLs.map(x => fetch(x))).then(function (responses) {
                    // Get a JSON object from each of the responses
                    return Promise.all(responses.map(function (response) {
                        return response.json();
                    }));
                }).then(function (data) {
                    var breweryAPIResults = [];
                    for (var i = 0; i < numCitiesNearby; i++) {
                        if (data[i].length > 0) {
                            data[i].forEach(value => breweryAPIResults.push(value));
                        }
                    }
                    console.log(breweryAPIResults)
                    //Send the breweryList to processBreweryData
                    processBreweryData(breweryAPIResults);
                }).catch(function (error) {
                    // TODO - Display an error message! (issue #31)
                    console.log(error);
                });
            })

        }
        else {
            console.log("response status: " + response.status);
            if (response.status == 404) {
                //show invalid ZIP error
                $("#BadZipCode").removeClass("hide");
            }
        }

    })

}

var processFavoriteClick = function(event) {
	var currentCB = $(this);
	event.stopPropagation();
	setBreweryFavorite(currentCB.closest("li").attr("data-index"), currentCB.prop("checked"));
}

var processVisitedClick = function(event) {
	var currentCB = $(this);
	event.stopPropagation();
	setBreweryVisited(currentCB.closest("li").attr("data-index"), currentCB.prop("checked"));
}

var processAddToTourClick = function() {
	var currentItem = $(this);

	$('#tourHelperPar').attr('style', 'color: black;');//if faulty click of tour button switched p to red, switch back

	toggleBreweryForTour(currentItem.closest("li").attr("data-index"));
}

var processMapToggle = function() {
	changeTourMode(!tourMode);
}

// Processes returned brewery data.
var processBreweryData = function (data) {
    breweryData = data;

    breweryData.sort(function (a, b) {
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

var newStartLocationHandler = function() {
	var buildKey = "";
	var state = $('#startState').val();
	var city = $('#startCity').val();
	var address = $('#startAddress').val().replace(/[^a-z0-9\s]/gi, '');
	
	for (var i = 0; i < bingFragments.length; i++) {
		buildKey += bingFragments[(13 * i) % bingFragments.length];
	}

	$('#invalidCity').addClass('hide');
	$('#invalidState').addClass('hide');

	if (!city) {
		$('#invalidCity').removeClass('hide');
		return;
	}

	console.log(state);

	if (!state) {
		$('#invalidState').removeClass('hide');
		return;
	}

	if (!address) {
		fetch(
			"https://dev.virtualearth.net/REST/v1/Locations/US/" + state + "/" + city.trim() + "?key=" + buildKey
		).then(function (response) {
			if (response.ok) {
				response.json().then(function (tmpData) {
					if (tmpData.resourceSets[0].resources[0].point.coordinates) {
						startingLat = tmpData.resourceSets[0].resources[0].point.coordinates[0];
						startingLon = tmpData.resourceSets[0].resources[0].point.coordinates[1];
						refreshMap();
						$('#startLocationForm').trigger('close');
					}
					
				})
			} 
		});
	} 

	else {
		fetch(
			"https://dev.virtualearth.net/REST/v1/Locations/US/" + state + "/" + city.trim() + "/" + address.trim() + "?key=" + buildKey
		).then(function (response) {
			if (response.ok) {
				response.json().then(function (tmpData) {
					if (tmpData.resourceSets[0].resources[0].point.coordinates) {
						startingLat = tmpData.resourceSets[0].resources[0].point.coordinates[0];
						startingLon = tmpData.resourceSets[0].resources[0].point.coordinates[1];
						refreshMap();
						$('#startLocationForm').trigger('close');
					}
					
				})
			} 
		});
	}

	
}

// Helper function - Retrieve missing lat/lon for brewery at the given index in our data.
var getLatitudeLongitude = function(idx, updateMapBounds=false) {
	var buildKey = "";

	for (var i = 0; i < bingFragments.length; i++) {
		buildKey += bingFragments[(13 * i) % bingFragments.length];
	}

	fetch(
		"https://dev.virtualearth.net/REST/v1/Locations/US/" + breweryData[idx].state.trim() + "/" + breweryData[idx].postal_code.trim() + "/" + breweryData[idx].city.trim() + "/" + breweryData[idx].street.trim() + "?key=" + buildKey
	).then(function (response) {
		if (response.ok) {
			response.json().then(function (tmpData) {
				if (tmpData.resourceSets[0].resources[0].point.coordinates) {
					breweryData[idx].latitude = tmpData.resourceSets[0].resources[0].point.coordinates[0];
					breweryData[idx].longitude = tmpData.resourceSets[0].resources[0].point.coordinates[1];
				}

				createMapPin(breweryData[idx]);

				if ((updateMapBounds) && (map)) {
					calculateMapBounds();
				}
			});
		}
	})
}

// Displays our current brewery data to the screen.
var displayBreweryData = function() {
	var i;
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

	for (i = 0; i < tourList.length; i++) {
		addBreweryToList(tourList[i], displayIndex);
		tourList[i].displayIndex = displayIndex++;
	}

	for (i = 0; i < breweryData.length; i++) {
		if (tourList.find(testBrewery => testBrewery.id == breweryData[i].id)) {
			continue; // Skip breweries we've already covered with tourList.
		} else  if ((breweryMeetsFilters(breweryData[i])) && (!tourMode)) {
			addBreweryToList(breweryData[i], displayIndex);
			breweryData[i].displayIndex = displayIndex++;
		} else {
			breweryData[i].displayIndex = null;
		}
	}

	//Update tour badge
	if (tourList.length > 0) {
		$('#tourCount').removeClass('hide');
		$('#tourCount').html(tourList.length);
	} 

	else if ($('#tourCount').attr('class') != 'badge primary hide') {
		$('#tourCount').addClass('hide');
	}

	refreshMap();
}

// Helper function used to check current brewer against filters.
// Logic in here only looks for reasons to disqualify, if we make it to the end it returns true by default.
var breweryMeetsFilters = function(curBrewery) {
	var filterMicro = $("#microFilter").prop("checked");
	var filterRegional = $("#regionalFilter").prop("checked");
	var filterBrewpub = $("#brewpubFilter").prop("checked");
	var filterLarge = $("#largeFilter").prop("checked");
	
	// Only check type filters if one is active.
	if (filterMicro || filterRegional || filterBrewpub || filterLarge) {
		switch (curBrewery.brewery_type) {
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
	if (($("#visitedFilter").prop("checked")) && (visitedList.indexOf(curBrewery.id) < 0)) {
		return false;
	} else if (($("#unvisitedFilter").prop("checked")) && (visitedList.indexOf(curBrewery.id) > -1)) {
		return false;
	}

	// Favorites filter.
	if (($("#favoritesFilter").prop("checked")) && (favoriteList.indexOf(curBrewery.id) < 0)) {
		return false;
	}

	return true;
}

// Helper function to append list items to the brewery list.
var addBreweryToList = function(curBrewery, displayIndex) {
	breweryList.append(
		"<li class='list-group-item flex-container align-justify align-middle brewery-list-item" + ((isBreweryInTourList(curBrewery)) ? "  tourSelection" : "") + " 'data-index='" + displayIndex + "'>" +
			"<div id='list-number' class='align-self-stretch'>" + (displayIndex + 1) +"</div>" +
			"<div>" +
				"<strong>" + curBrewery.name + "</strong>" +
				"<p class='subheader'>" + curBrewery.street + ", " + curBrewery.city + "</p>" +
			"</div>" +
			"<div class='flex-container'>" +
				"<div class='checkbox'>" +
					"<input class='checkbox-element' type='checkbox'  name='favorite'" + ((favoriteList.indexOf(curBrewery.id) > -1) ? "checked" : "") + ">" +
					"<i class='foundicon-heart'></i>" +
				"</div>" +
				"<div class='checkbox'>" +
					"<input class='checkbox-element' type='checkbox' name='visited'" + ((visitedList.indexOf(curBrewery.id) > -1) ? "checked" : "") + ">" +
					"<i class='foundicon-checkmark'></i>" +
				"</div>" +
			"</div>" +
		"</li>"
	);
}

// Resets the map widget.
var refreshMap = function() {
	var i;

	// If we already have a map, clear all markers.  Otherwise, make the map.
	if (map) {
		map.entities.clear();
	}
	else {
		map = new Microsoft.Maps.Map("#mapDisplay");
	}

	if (directionsManager) {
		directionsManager.clearAll();
	}

	if (tourMode) {
		Microsoft.Maps.loadModule("Microsoft.Maps.Directions", function () {
			if (!directionsManager) {
				directionsManager = new Microsoft.Maps.Directions.DirectionsManager(map);
			}
			
			directionsManager.setRequestOptions({ routeDraggable: false, routeMode: Microsoft.Maps.Directions.RouteMode.driving });
			directionsManager.setRenderOptions({ itineraryContainer: document.querySelector("#displayInfo") });

			var tourLocs = Array.from(tourList);

			// If we have a starting location, add it as the first waypoint and use it to sort the tour list.
			if ((startingLat) && (startingLon)) {
				var loc = new Microsoft.Maps.Location(startingLat, startingLon);
				directionsManager.addWaypoint(new Microsoft.Maps.Directions.Waypoint({ address: "You Are Here", location: loc}));
				tourSort(startingLat, startingLon, 0, tourLocs);
			} else { // Otherwise, the first tour list item will be used as the sorting basis.
				tourSort(tourLocs[0].latitude, tourLocs[0].longitude, 1, tourLocs);
				// TODO - Show a form for user to enter their address?
			}

			for (i = 0; i < tourLocs.length; i++) {
				directionsManager.addWaypoint(new Microsoft.Maps.Directions.Waypoint({ address: tourLocs[i].name, location: tourLocs[i].pin.getLocation()}))
			}

			directionsManager.calculateDirections();
		});
	} else {
		// Add all pins to the map!
		for (i = 0; i < tourList.length; i++) {
			createMapPin(tourList[i]);
		}

		for (i = 0; i < breweryData.length; i++) {
			if ((breweryData[i].latitude) && (breweryData[i].longitude) && (!isBreweryInTourList(breweryData[i]))) {
				createMapPin(breweryData[i]);
			}
		}
	}

	calculateMapBounds();
}

// Utility function - Sorts tour list recursively, finding the closest item to the passed in lat/lon.
var tourSort = function(lat, lon, idx, list) {
	var closestIdx;
	var closestDistance = 10000;

	for (var i = idx; i < list.length; i++) {
		var diff;
		var dist;

		// Calculate distance.
		diff = list[i].latitude - lat;
		dist = diff * diff;
		diff = list[i].longitude - lon;
		dist += diff * diff;
		dist = Math.sqrt(dist);

		// Hold on to current info if it's the closest.
		if (dist < closestDistance) {
			closestIdx = i;
			closestDistance = dist;
		}
	}

	// Take the closest list item and put at the 'idx' position that was passed in.
	var pullMe = list.splice(closestIdx, 1);
	list.splice(idx, 0, pullMe[0]);

	// Continue our sort if necessary.  No need for it on last item because there's nothing to compare to.
	if (idx < list.length - 1) {
		tourSort(list[idx].latitude, list[idx].longitude, idx + 1, list);
	}
}

// Change the viewing area for the map.
// Called when pins are added, but also as getLatitudeLongitude calls come in.
var calculateMapBounds = function() {
	var i;
	var doSet = false;
	var locs = [];

	for (i = 0; i < tourList.length; i++) {
		locs.push(tourList[i].pin.getLocation());
		doSet = true;
	}

	for (i = 0; i < breweryData.length; i++) {
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
var createMapPin = function(curBrewery) {
	// Don't make a pin if this brewery isn't set to display.
	if (curBrewery.displayIndex == null) {
		return;
	}

	if (!curBrewery.pin) {
		var icon;

		if (favoriteList.indexOf(curBrewery.id) > -1) {
			icon = breweryIconFavorite;
		} else if (visitedList.indexOf(curBrewery.id) > -1) {
			icon = breweryIconVisited;
		} else {
			icon = breweryIconDefault;
		}

		var loc = new Microsoft.Maps.Location(curBrewery.latitude, curBrewery.longitude);
		pin = new Microsoft.Maps.Pushpin(loc, {
			title: curBrewery.name,
			text: (curBrewery.displayIndex + 1).toString(),
			icon: icon
		});

		curBrewery.pin = pin; // Save our pin so we can manipulate it later.
	} else {
		curBrewery.pin.setOptions({text: (curBrewery.displayIndex + 1).toString()});
	}

	if ((isBreweryInTourList(curBrewery)) || (breweryMeetsFilters(curBrewery))) {
		if (map.entities.indexOf(curBrewery.pin) < 0) {
			map.entities.push(curBrewery.pin);
		}
	} else if (map.entities.indexOf(curBrewery.pin > -1)) {
		map.entities.remove(curBrewery.pin)
	}
}

var changeTourMode = function(newMode) {
	if (newMode == tourMode) {
		return;
	} else if ((newMode) && (!tourList.length)) {
		$('#tourHelperPar').attr('style', 'color: red;');
		return;
	}

	tourMode = newMode;
	$("#brew-toggle-list").toggleClass("hollow", tourMode);
	$("#brew-toggle-tour").toggleClass("hollow", !tourMode);
	$('#tourHelperPar').toggleClass('hide', tourMode);
	$('#startLocationButton').toggleClass('hide', !tourMode);

	// Brewery List would have been destroyed by tour mode, make sure we restore it.
	if (!tourMode) {
		$("#displayInfo").text("").append("<ol id='breweryList' class='list-group'></ol>");
		breweryList = $("#breweryList");
		breweryList.on("click", "div:not(.flex-container)", processAddToTourClick);
		breweryList.on("click", "input[name='favorite']", processFavoriteClick);
		breweryList.on("click", "input[name='visited']", processVisitedClick);
	}

	displayBreweryData();
}

var setBreweryFavorite = function(idx, favorite) {
	var curBrewery = getDisplayedBrewery(idx);

	if (favorite) {
		if (!isBreweryInTourList(curBrewery)) {
			curBrewery.pin.setOptions({icon: breweryIconFavorite});
		}

		if (favoriteList.indexOf(curBrewery.id) < 0) {
			favoriteList.push(curBrewery.id);
		}
	} else {
		if (!isBreweryInTourList(curBrewery)) {
			var icon = (visitedList.indexOf(curBrewery.id) < 0) ? breweryIconDefault : breweryIconVisited;
			curBrewery.pin.setOptions({icon: icon});
		}

        var findMe = favoriteList.indexOf(curBrewery.id);

        if (findMe > -1) {
            favoriteList.splice(findMe, 1);
        }
    }

    localStorage.setItem("hopToFavorites", JSON.stringify(favoriteList));
}

var setBreweryVisited = function(idx, visited) {
	var curBrewery = getDisplayedBrewery(idx);

	if (visited) {
		// Only change color if not already favorited or selected for tour.
		if ((favoriteList.indexOf(curBrewery.id) < 0) && (!isBreweryInTourList(curBrewery))) {
			curBrewery.pin.setOptions({icon: breweryIconVisited});
		}

		if (visitedList.indexOf(curBrewery.id) < 0) {
			visitedList.push(curBrewery.id);
		}
	} else {
		// Only change color if not already favorited or selected for tour.
		if ((favoriteList.indexOf(curBrewery.id) < 0) && (!isBreweryInTourList(curBrewery))) {
			curBrewery.pin.setOptions({icon: breweryIconDefault});
		}

        var findMe = visitedList.indexOf(curBrewery.id);

        if (findMe > -1) {
            visitedList.splice(findMe, 1);
        }
    }

    localStorage.setItem("hopToVisited", JSON.stringify(visitedList));
}

var toggleBreweryForTour = function(idx) {
	var curBrewery = getDisplayedBrewery(idx);

	if (isBreweryInTourList(curBrewery)) {
		var icon = breweryIconDefault;
		var findMe = tourList.findIndex(element => element.id == curBrewery.id);

		if (findMe > -1) {
			tourList.splice(findMe, 1);
		}

		if (favoriteList.indexOf(curBrewery.id) > -1) {
			icon = breweryIconFavorite;
		} else if (visitedList.indexOf(curBrewery.id) > -1) {
			icon = breweryIconVisited;
		}

		curBrewery.pin.setOptions({icon: icon});

		// If no tour destinations, make sure tour mode is off.
		if (tourList.length == 0) {
			changeTourMode(false);
		}
	} else {
		tourList.push(curBrewery);
		breweryData.sort(function(a, b) {
			return a.name.localeCompare(b.name);
		});
		curBrewery.pin.setOptions({icon: breweryIconTourSelect});
	}

	// Force the list to refresh.
	displayBreweryData();
}

// Utility function to get breweryData index based on displayIndex
var getDisplayedBrewery = function(idx) {
	var checkTours = tourList.find((element) => element.displayIndex == idx);

	if (checkTours) {
		return checkTours;
	} else {
		return breweryData.find((element) => element.displayIndex == idx);
	}
}

var isBreweryInTourList = function(testBrewery) {
	return (tourList.findIndex(checkBrewery => checkBrewery.id == testBrewery.id) > -1);
}

// Assembles our Bing key and adds the necessary JS reference.
var initialize = function() {
	var buildKey = "";

	for (var i = 0; i < bingFragments.length; i++) {
		buildKey += bingFragments[(13 * i) % bingFragments.length];
	}

	var scriptEl = document.createElement("script");
	scriptEl.setAttribute("type", "text/javascript");
	scriptEl.setAttribute("src", "https://www.bing.com/api/maps/mapcontrol?callback=refreshMap&key=" + buildKey);
	scriptEl.setAttribute("async", "");
	scriptEl.setAttribute("defer", "");
	document.head.appendChild(scriptEl);

	if (navigator.geolocation)
	{
		navigator.geolocation.getCurrentPosition((position) => 
		{
			fetch(
				"https://dev.virtualearth.net/REST/v1/Locations/" + position.coords.latitude + "," + position.coords.longitude + "?key=" + buildKey
			).then(function (response) {
				if (response.ok) {
					response.json().then(function (data) {
						// Weirdly, the city doesn't get its own field in the response, so we'll extract it from the full address.
						// Formatted address looks like: "123 Easy St, Anytown, WI 54799"
						var addressParts = data.resourceSets[0].resources[0].address.formattedAddress.split(",");

						startingAddress = data.resourceSets[0].resources[0].address.addressLine;
						startingCity = addressParts[1].trim();
						startingZip = data.resourceSets[0].resources[0].address.postalCode;

						startingLat = data.resourceSets[0].resources[0].point.coordinates[0];
						startingLon = data.resourceSets[0].resources[0].point.coordinates[1];

						$("#byCity").val(startingCity);
						$("#distanceZip").val(startingZip);

						if (data.resourceSets[0].resources[0].address.adminDistrict in stateLookup) {
							startingState = stateLookup[data.resourceSets[0].resources[0].address.adminDistrict];
							$("#byState").val(startingState);
						}

						$('#startState').val(data.resourceSets[0].resources[0].address.adminDistrict);
						$('#startCity').val(startingCity);
						$('#startAddress').val(startingAddress);
					});
				}
			});
		});
	}
}

initialize();
$(document).foundation();

$('#startLocationSubmit').on('click', newStartLocationHandler);
$("#searchCityState").on("click", searchCityState);
$("#searchZipRadius").on("click", searchZipRadius);
$("#filterBy").on("click", "input", displayBreweryData);
breweryList.on("click", "div:not(.flex-container)", processAddToTourClick);
breweryList.on("click", "input[name='favorite']", processFavoriteClick);
breweryList.on("click", "input[name='visited']", processVisitedClick);
$("#brew-toggle").on("click", "a.hollow", processMapToggle);
