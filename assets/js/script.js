// Simple obfuscation to prevent scraping - key is scrambled here and then reassembled in code.
const bingFragments = [ "Anhz", "u3sc", "lddW", "XySE", "_-mD", "47H8", "2t3i", "GAHV", "uUrv", "6zb1", "QY5f", "_m2a", "Y-df", "-5A2", "lzMb", "8FyP" ];
const zipFragments = [ "5fMZ", "uis6", "biA4", "ZNwR", "9h1q", "ZKEC", "nEdI", "Up8D", "Eaiq", "OyJG", "UPNU", "r7eG", "ri8E", "MCxz", "EloA", "75Qa" ];

const breweryColorDefault = "#208020";
const breweryColorFavorite = "#4080ff";
const breweryColorVisited = "#206020";

var breweryList = $("#breweryList");

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
		// TODO - Display error message! (no city or state entered)
		return;
	}

	// TODO - Add filters if needed - probably put this in its own function so radius search can use it too.

	fetch(fetchUrl + "per_page=50").then(function (response) {
		breweryList.text(""); // Clear previous results.

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

// Displays returned brewery data to the screen.
var processBreweryData = function(data) {
	breweryData = data;

	for (var i = 0; i < breweryData.length; i++) {
		breweryList.append(
			"<li class='list-group-item flex-container align-justify align-middle'>" +
                "<div>" +
                  "<strong>" + breweryData[i].name + "</strong>" +
                  "<p class='subheader'>" + breweryData[i].street + ", " + breweryData[i].city + "</p>" +
                "</div>" +
                "<div class='flex-container'>" +
                  "<div class='checkbox'>" +
                    "<input id='favorite' class='checkbox-element' type='checkbox'  name='favorite' value='favorited'>" + // TODO - Set value! -done
                    "<i class='foundicon-heart'></i>" +
                  "</div>" +
                  "<div class='checkbox'>" +
                    "<input id='check' class='checkbox-element' type='checkbox' name='visited' value='visited'>" + // TODO - Set value! -done
                    "<i class='foundicon-checkmark'></i>" +
                  "</div>" +
                "</div>" +
              "</li>"
		);

		// If we don't have location info, get it from Bing!
		if ((!breweryData[i].latitude) || (!breweryData[i].longitude)) {
			getLatitudeLongitude(i);
		}
	}

	refreshMap();
}

// Helper function - Retrieve missing lat/lon for brewery at the given index in our data.
var getLatitudeLongitude = function(idx) {
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
			});
		}
	})
}

// Resets the map widget.
var refreshMap = function() {
	if (!breweryList.children().length) {
		// TODO - Hide output div!  Just adding Foundation's hide class here breaks layout???
		//$("#output").addClass("hide");
		return;
	}

	var pin;

	// If we already have a map, clear all markers.  Otherwise, make the map.
	if (map) {
		map.entities.clear();
	}
	else {
		map = new Microsoft.Maps.Map("#mapDisplay");
	}

	// TODO - Unhide output div!
	//$("#output").removeClass("hide");

	for (var i = 0; i < breweryData.length; i++) {
		if ((breweryData[i].latitude) && (breweryData[i].longitude)) {
			createMapPin(i);
		}
	}

	// TODO - Calculate map position/bounds so it shows all pins!
}

// Creates a map pin for the brewery at the specified index.
// This is in its own function because it can be used by getLatitudeLongitude or refreshMap.
var createMapPin = function(idx) {
	if (!breweryData[idx].pin) {
		//Create custom Pushpin
		var loc = new Microsoft.Maps.Location(breweryData[idx].latitude, breweryData[idx].longitude);
		pin = new Microsoft.Maps.Pushpin(loc, {
			title: breweryData[idx].name,
			color: breweryColorDefault, // TODO - Pick color based on favorite/visited status!
			text: (idx + 1).toString()
		});

		breweryData[idx].pin = pin; // Save our pin so we can manipulate it later.

		//Add the pushpin to the map
		map.entities.push(pin);
	}
}

var setBreweryFavorite = function(idx, favorite) {
	// TODO - localStorage manipulation!
	if (favorite) {
		breweryData[idx].pin.setOptions({color: breweryColorFavorite});
	} else {
		// TODO - Check visited status and set accordingly!
		breweryData[idx].pin.setOptions({color: breweryColorDefault});
	}
}

var setBreweryVisited = function(idx, visited) {
	// TODO - localStorage manipulation!
	// TODO - Once we can check if a brewery is favorited, we shoult let the favorite color overrule, and return out of here.
	if (visited) {
		breweryData[idx].pin.setOptions({color: breweryColorVisited});
	} else {
		breweryData[idx].pin.setOptions({color: breweryColorDefault});
	}
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
}

initialize();
$(document).foundation();

$("#searchCityState").on("click", searchCityState);