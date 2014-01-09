dojo.require("dijit.layout.BorderContainer");
dojo.require("dijit.layout.ContentPane");
dojo.require("esri.arcgis.utils");
dojo.require("esri.map");

/******************************************************
***************** begin config section ****************
*******************************************************/

var FEATURE_SERVICE_URL = "http://services.arcgis.com/nzS0F0zdNLvs7nc8/arcgis/rest/services/YuccaFlat_deliverymethod/FeatureServer/0";

/******************************************************
***************** end config section ******************
*******************************************************/

var _map;

var _dojoReady = false;
var _jqueryReady = false;

var _homeExtent; // set this in init() if desired; otherwise, it will 
				 // be the default extent of the web map;

var _isMobile = isMobile();
var _isIE = (navigator.appVersion.indexOf("MSIE") > -1);
var _isEmbed = false;

var _layerBottom;
var _layerTop;

var _locations;
var _index = 0;

var _table = [
	{year_begin:1950,year_end:1955},
	{year_begin:1956,year_end:1960},
	{year_begin:1961,year_end:1965},
	{year_begin:1966,year_end:1970},
	{year_begin:1971,year_end:1975},
	{year_begin:1976,year_end:1980},
	{year_begin:1981,year_end:1985},
	{year_begin:1986,year_end:1989}		
];

var _timeline;

/*

might need this if you're using icons.

var _lutBallIconSpecs = {
	tiny:new IconSpecs(24,24,12,12),
	medium:new IconSpecs(30,30,15,15),
	large:new IconSpecs(30,30,15,15)
}
*/

dojo.addOnLoad(function() {_dojoReady = true;init()});
jQuery(document).ready(function() {_jqueryReady = true;init()});

function init() {
	
	if (!_jqueryReady) return;
	if (!_dojoReady) return;
	
	// determine whether we're in embed mode
	
	var queryString = esri.urlToObject(document.location.href).query;
	if (queryString) {
		if (queryString.embed) {
			if (queryString.embed.toUpperCase() == "TRUE") {
				_isEmbed = true;
			}
		}
	}
	
	// jQuery event assignment
	
	$(this).resize(handleWindowResize);
	
	$("#zoomIn").click(function(e) {
        _map.setLevel(_map.getLevel()+1);
    });
	$("#zoomOut").click(function(e) {
        _map.setLevel(_map.getLevel()-1);
    });
	$("#zoomExtent").click(function(e) {
        _map.setExtent(_homeExtent);
    });
	
	_map = new esri.Map("map",{slider:false,wrapAround180:false,basemap:"satellite"});

	if(_map.loaded){
		initMap();
	} else {
		dojo.connect(_map,"onLoad",function(){
			initMap();
		});
	}
	
}

function initMap() {
	
	
	_layerBottom = new esri.layers.GraphicsLayer();
	_map.addLayer(_layerBottom);

	_layerTop = new esri.layers.GraphicsLayer();
	_map.addLayer(_layerTop);

	var query = new esri.tasks.Query();
	query.where = "1 = 1";
	query.returnGeometry = true;
	query.outFields = ["*"];

	var queryTask = new esri.tasks.QueryTask(FEATURE_SERVICE_URL);
	queryTask.execute(query, function(result){
		_locations = result.features;
		situate();
		// extent adjustment needs to be on a slight lag to give
		// browser chance to deal with initial sizing
		setTimeout(function(){
				_homeExtent = getGraphicsExtent(_locations);
				_homeExtent = _homeExtent.expand(1.2);
				_map.setExtent(_homeExtent);
			},500);
		setTimeout(function(){$("#whiteOut").fadeOut()},1000);
	});		
	
	_timeline = new Timeline(
		1950,
		2000,
		5,
		[{
			year: 1952
		},{
			year: 1957
		},{
			year: 1966
		},{
			year: 1970
		},{
			year: 1974
		},{
			year: 1999
		},{
			year: 1984
		},{
			year: 1981
		}]			
	);		
		
	dojo.connect(_layerBottom, "onMouseOver", layer_onMouseOver);
	dojo.connect(_layerBottom, "onMouseOut", layer_onMouseOut);
	dojo.connect(_layerBottom, "onClick", layer_onClick);		

	dojo.connect(_layerTop, "onMouseOver", layer_onMouseOver);
	dojo.connect(_layerTop, "onMouseOut", layer_onMouseOut);
	dojo.connect(_layerTop, "onClick", layer_onClick);

	$(document).keydown(onKeyDown);
	
	handleWindowResize();
	
}

function situate()
{
	symbolize();
	displayYears();
}

function onKeyDown(e)
{
	
	if ((e.keyCode != 38) && (e.keyCode != 40)) {
		return;
	}

	situate();
	
}

function displayYears()
{
	var year_begin = _table[_index].year_begin;
	var year_end = _table[_index].year_end;
	$("#year").html(year_begin+" - "+year_end);		
}

function symbolize()
{

	var year_begin = _table[_index].year_begin;
	var year_end = _table[_index].year_end;
	
	_layerBottom.clear();
	_layerTop.clear();

	var color;
	var opacity;
	$.each(_locations, function(index, value) {
		if (
			(parseInt(value.attributes.Date_Converted_Year) >= year_begin) && 
			(parseInt(value.attributes.Date_Converted_Year) <= year_end)
			) 
		{
			color = [255,0,0];
			opacity = 1;
			_layerTop.add(value);
		} else if (parseInt(value.attributes.Date_Converted_Year) < year_begin) {
			color = [190,190,190];
			opacity = 0.37;
			_layerBottom.add(value);
		} else if (parseInt(value.attributes.Date_Converted_Year) > year_end) {
			color = [190,190,190];
			opacity = 0.37;
			//_layerBottom.add(value);			
		} else {
			color = [0,0,0];
			opacity = 1;
			_layerBottom.add(value);			
		}
		value.setSymbol(createSymbol(10,color,opacity));
	});	
}

createSymbol = function(size, rgb, opacity)
{
	return new esri.symbol.SimpleMarkerSymbol(
				esri.symbol.SimpleMarkerSymbol.STYLE_CIRCLE, size,
				new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([0,0,0].concat([opacity])), 2),
				new dojo.Color(rgb.concat([opacity]))
			);	
}


function layer_onMouseOver(event) 
{
	if (_isMobile) return;
	var graphic = event.graphic;
	_map.setMapCursor("pointer");
	graphic.setSymbol(graphic.symbol.setSize(12));
	/*
	if ($.inArray(graphic, _selected) == -1) {
		graphic.setSymbol(resizeSymbol(graphic.symbol, _lutBallIconSpecs.medium));
	}
	*/
	if (!_isIE) moveGraphicToFront(graphic);	
	$("#hoverInfo").html("<b>"+graphic.attributes.Date_Converted_Year+"</b>");
	var pt = _map.toScreen(graphic.geometry);
	hoverInfoPos(pt.x,pt.y);	
}


function layer_onMouseOut(event) 
{
	var graphic = event.graphic;
	graphic.setSymbol(graphic.symbol.setSize(10));
	_map.setMapCursor("default");
	$("#hoverInfo").hide();
	/*
	if ($.inArray(graphic, _selected) == -1) {
		graphic.setSymbol(resizeSymbol(graphic.symbol, _lutBallIconSpecs.tiny));
	}
	*/
}


function layer_onClick(event) 
{
	/*
	$("#hoverInfo").hide();
	var graphic = event.graphic;
	_languageID = graphic.attributes.getLanguageID();
	$("#selectLanguage").val(_languageID);
	changeState(STATE_SELECTION_OVERVIEW);
	scrollToPage($.inArray($.grep($("#listThumbs").children("li"),function(n,i){return n.value == _languageID})[0], $("#listThumbs").children("li")));	
	*/
}

/*

function createIconMarker(iconPath, spec) 
{
	return new esri.symbol.PictureMarkerSymbol(iconPath, spec.getWidth(), spec.getHeight()); 
}

function resizeSymbol(symbol, spec)
{
	return symbol.setWidth(spec.getWidth()).setHeight(spec.getHeight())	
}


*/
function moveGraphicToFront(graphic)
{
	var dojoShape = graphic.getDojoShape();
	if (dojoShape) dojoShape.moveToFront();
}

function hoverInfoPos(x,y){
	if (x <= ($("#map").width())-230){
		$("#hoverInfo").css("left",x+15);
	}
	else{
		$("#hoverInfo").css("left",x-25-($("#hoverInfo").width()));
	}
	if (y >= ($("#hoverInfo").height())+50){
		$("#hoverInfo").css("top",y-35-($("#hoverInfo").height()));
	}
	else{
		$("#hoverInfo").css("top",y-15+($("#hoverInfo").height()));
	}
	$("#hoverInfo").show();
}


function handleWindowResize() {
	/*
	if ((($("body").height() <= 500) || ($("body").width() <= 800)) || _isEmbed) $("#header").height(0);
	else $("#header").height(115);
	*/
	$("#map").width($("body").width() - $("#left").width() - $("#middle").width());
	_map.resize();
	$("#timeline").height($("#middle").height() - $("#year-case").height() - 10);
	if (_timeline) _timeline.updateLayout();
}
