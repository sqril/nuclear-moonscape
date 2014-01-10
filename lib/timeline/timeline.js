function Timeline(_startYear, _endYear, _periodInt, _eventYears)
{

	var _intevalCount = ((_endYear - _startYear) / _periodInt);
	var _index = 0;
	var _that = this;
	
	createTimeline();
	$(".handle").draggable({
		cursor: "default",
		axis: "y",
		containment: "parent",
		stop: function() {
			updateIndex(findClosestPeriod(parseInt($(".handle").css("top"))));
		},
		drag: function(event, ui) {
			// put limiters on handle y's
			// var top = parseInt($(".handle").css("top"));
			// if (top < 5) $(".handle").css("top", "5px");
		}
	});
	
	$(".period-bar").click(function(e) {
		updateIndex($.inArray(e.currentTarget, $(".period-bar")));
	});
	
	$(".event-wrapper").click(function(e) {
    	$(_that).trigger("eventSelection",[e.currentTarget,$.inArray(e.currentTarget, $(".event-wrapper"))]);   
    });		

	$(".event-wrapper").mouseenter(function(e) {
    	$(_that).trigger("eventHover",[e.currentTarget,$.inArray(e.currentTarget, $(".event-wrapper"))]);   
    });		

	function createTimeline()
	{
		for (var i = 0; i < _intevalCount; i++){
			$("#timeline").append('<div class="period-wrapper">\
				' + (i === 0 ? '<div class="period-year first-year">' + _startYear + '</div>' : '') + '\
				<div class="period-bar"></div>\
				' + (i === _intevalCount - 1 ? '<div class="period-year last-year">' + (_startYear + (_periodInt * (i + 1))) + '</div>' : '<div class="period-year">' + (_startYear + (_periodInt * (i + 1))) + '</div>') + '\
			</div>');
		}
		
		var handle = $("<div class='handle'></div>");
		$(handle).append("<img src='resources/images/PointerUp.png' style='position:absolute;top:5px;left:7px'/>");
		$(handle).append("<img src='resources/images/PointerDown.png' style='position:absolute;bottom:5px;left:7px'/>");
		$("#timeline").append(handle);
	
		for (var j = 0; j < _eventYears.length; j++){
			var calc = _eventYears[j].year - _startYear,
				period = Math.floor(calc/_periodInt),
				offset = ((calc % _periodInt)/_periodInt) * 100;
	
				$(".period-wrapper").eq(period).append('<div class="event-wrapper" style="top: ' + offset + '%;' + (offset === 0 ? 'margin-top: -11px;' : '') + '">\
					<div class="year-text">' + _eventYears[j].year + '</div>\
					<div class="arrow-block"></div>\
					<div class="arrow-outline"></div>\
					<div class="arrow-main"></div>\
				</div>');
		}
		
		resizeTimeline();
			
	}
	
	function resizeTimeline()
	{
		$(".period-wrapper").css({
			"height": Math.floor((($("#timeline").outerHeight() - 5)/_intevalCount) - 5)
		});
		$(".handle").height($(".period-bar").height()); 
		$(".handle").css("top", calcTop(_index));
	}
	
	function findClosestPeriod(handleTop)
	{
	
		var minDiff = Number.MAX_VALUE;
		var diff;
		var closest;
		
		for (var i = 0; i < $(".period-wrapper").length; i++) {
			diff = Math.abs(handleTop - calcTop(i));
			if (diff < minDiff) {
				minDiff = diff;
				closest = i;
			}
		}
		
		return closest;
	
	}
	
	function updateIndex(index)
	{
		_index = index;
		$(".handle").animate({top: calcTop(index)}, "linear", function(){
			$(_that).trigger("indexChange");
		});
	}

	function calcTop(index)
	{
		return $(".period-wrapper").eq(index).position().top + parseInt($(".period-wrapper").css("margin-top"));
	}
	
	this.stepUp = function()
	{
		if (_index > 0) updateIndex(_index - 1);
	}
	
	this.stepDown = function()
	{
		if (_index < $(".period-wrapper").length - 1) updateIndex(_index + 1);	
	}
	
	this.updateLayout = function()
	{
		resizeTimeline();
	}
	
	this.getCurrentIndex = function()
	{
		return _index;
	}
	
}
