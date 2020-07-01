import * as userSettings from 'userSettings';
import skinManager from 'skinManager';
import connectionManager from 'connectionManager';
import events from 'events';

var currentViewType;

pageClassOn('viewbeforeshow', 'page', function () {
    skinManager.setTheme(userSettings.theme());
});

events.on(connectionManager, 'localusersignedin', function (e, user) {
    currentViewType = null;
});
