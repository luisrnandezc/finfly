sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"finfly/flightreports/test/integration/pages/FlightReportsList",
	"finfly/flightreports/test/integration/pages/FlightReportsObjectPage"
], function (JourneyRunner, FlightReportsList, FlightReportsObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('finfly/flightreports') + '/test/flp.html#app-preview',
        pages: {
			onTheFlightReportsList: FlightReportsList,
			onTheFlightReportsObjectPage: FlightReportsObjectPage
        },
        async: true
    });

    return runner;
});

