define(['require', 'browser', 'layoutManager', 'appSettings', 'pluginManager', 'apphost', 'focusManager', 'datetime', 'globalize', 'loading', 'connectionManager', 'skinManager', 'dom', 'events', 'emby-select', 'emby-checkbox', 'emby-button'], function (require, browser, layoutManager, appSettings, pluginManager, appHost, focusManager, datetime, globalize, loading, connectionManager, skinManager, dom, events) {
    'use strict';

    function fillThemes(select) {
        skinManager.getThemes().then(function (themes) {
            select.innerHTML = themes.map(function (t) {
                return '<option value="' + t.id + '">' + t.name + '</option>';
            }).join('');
        });
    }

    function loadScreensavers(context, userSettings) {
        var selectScreensaver = context.querySelector('.selectScreensaver');
        var options = pluginManager.ofType('screensaver').map(function (plugin) {
            return {
                name: plugin.name,
                value: plugin.id
            };
        });

        options.unshift({
            name: globalize.translate('None'),
            value: 'none'
        });

        selectScreensaver.innerHTML = options.map(function (o) {
            return '<option value="' + o.value + '">' + o.name + '</option>';
        }).join('');
        selectScreensaver.value = userSettings.screensaver();

        if (!selectScreensaver.value) {
            // TODO: set the default instead of none
            selectScreensaver.value = 'none';
        }
    }

    function showOrHideMissingEpisodesField(context, user, apiClient) {

        if (browser.tizen || browser.web0s) {
            context.querySelector('.fldDisplayMissingEpisodes').classList.add('hide');
            return;
        }

        context.querySelector('.fldDisplayMissingEpisodes').classList.remove('hide');
    }

    function loadForm(context, user, userSettings, apiClient) {

        var loggedInUserId = apiClient.getCurrentUserId();
        var userId = user.Id;

        if (appHost.supports('displaylanguage')) {
            context.querySelector('.languageSection').classList.remove('hide');
        } else {
            context.querySelector('.languageSection').classList.add('hide');
        }

        if (appHost.supports('displaymode')) {
            context.querySelector('.fldDisplayMode').classList.remove('hide');
        } else {
            context.querySelector('.fldDisplayMode').classList.add('hide');
        }

        if (appHost.supports('externallinks')) {
            context.querySelector('.learnHowToContributeContainer').classList.remove('hide');
        } else {
            context.querySelector('.learnHowToContributeContainer').classList.add('hide');
        }

        if (appHost.supports('screensaver')) {
            context.querySelector('.selectScreensaverContainer').classList.remove('hide');
        } else {
            context.querySelector('.selectScreensaverContainer').classList.add('hide');
        }

        if (datetime.supportsLocalization()) {
            context.querySelector('.fldDateTimeLocale').classList.remove('hide');
        } else {
            context.querySelector('.fldDateTimeLocale').classList.add('hide');
        }

        if (!browser.tizen && !browser.web0s) {
            context.querySelector('.fldBackdrops').classList.remove('hide');
            context.querySelector('.fldThemeSong').classList.remove('hide');
            context.querySelector('.fldThemeVideo').classList.remove('hide');
        } else {
            context.querySelector('.fldBackdrops').classList.add('hide');
            context.querySelector('.fldThemeSong').classList.add('hide');
            context.querySelector('.fldThemeVideo').classList.add('hide');
        }

        var selectTheme = context.querySelector('#selectTheme');

        fillThemes(selectTheme);
        loadScreensavers(context, userSettings);

        context.querySelector('.chkDisplayMissingEpisodes').checked = user.Configuration.DisplayMissingEpisodes || false;

        context.querySelector('#chkThemeSong').checked = userSettings.enableThemeSongs();
        context.querySelector('#chkThemeVideo').checked = userSettings.enableThemeVideos();
        context.querySelector('#chkFadein').checked = userSettings.enableFastFadein();
        context.querySelector('#chkBlurhash').checked = userSettings.enableBlurhash();
        context.querySelector('#chkBackdrops').checked = userSettings.enableBackdrops();
        context.querySelector('#chkDetailsBanner').checked = userSettings.detailsBanner();

        context.querySelector('#selectLanguage').value = userSettings.language() || '';
        context.querySelector('.selectDateTimeLocale').value = userSettings.dateTimeLocale() || '';

        context.querySelector('#txtLibraryPageSize').value = userSettings.libraryPageSize();

        skinManager.getThemes().then(themes => {
            var defaultTheme = themes.find(theme => {
                return theme.default;
            });

            selectTheme.value = userSettings.theme() || defaultTheme.id;
        });

        context.querySelector('.selectLayout').value = layoutManager.getSavedLayout() || '';

        showOrHideMissingEpisodesField(context, user, apiClient);

        loading.hide();
    }

    function saveUser(context, user, userSettingsInstance, apiClient) {
        user.Configuration.DisplayMissingEpisodes = context.querySelector('.chkDisplayMissingEpisodes').checked;

        if (appHost.supports('displaylanguage')) {
            userSettingsInstance.language(context.querySelector('#selectLanguage').value);
        }

        userSettingsInstance.dateTimeLocale(context.querySelector('.selectDateTimeLocale').value);

        userSettingsInstance.enableThemeSongs(context.querySelector('#chkThemeSong').checked);
        userSettingsInstance.enableThemeVideos(context.querySelector('#chkThemeVideo').checked);
        userSettingsInstance.theme(context.querySelector('#selectTheme').value);
        userSettingsInstance.screensaver(context.querySelector('.selectScreensaver').value);

        userSettingsInstance.libraryPageSize(context.querySelector('#txtLibraryPageSize').value);

        userSettingsInstance.enableFastFadein(context.querySelector('#chkFadein').checked);
        userSettingsInstance.enableBlurhash(context.querySelector('#chkBlurhash').checked);
        userSettingsInstance.enableBackdrops(context.querySelector('#chkBackdrops').checked);
        userSettingsInstance.detailsBanner(context.querySelector('#chkDetailsBanner').checked);

        if (user.Id === apiClient.getCurrentUserId()) {
            skinManager.setTheme(userSettingsInstance.theme());
        }

        layoutManager.setLayout(context.querySelector('.selectLayout').value);
        return apiClient.updateUserConfiguration(user.Id, user.Configuration);
    }

    function save(instance, context, userId, userSettings, apiClient, enableSaveConfirmation) {
        loading.show();

        apiClient.getUser(userId).then(function (user) {
            saveUser(context, user, userSettings, apiClient).then(function () {
                loading.hide();
                if (enableSaveConfirmation) {
                    require(['toast'], function (toast) {
                        toast(globalize.translate('SettingsSaved'));
                    });
                }
                events.trigger(instance, 'saved');
            }, function () {
                loading.hide();
            });
        });
    }

    function onSubmit(e) {
        var self = this;
        var apiClient = connectionManager.getApiClient(self.options.serverId);
        var userId = self.options.userId;
        var userSettings = self.options.userSettings;

        userSettings.setUserInfo(userId, apiClient).then(function () {
            var enableSaveConfirmation = self.options.enableSaveConfirmation;
            save(self, self.options.element, userId, userSettings, apiClient, enableSaveConfirmation);
        });

        // Disable default form submission
        if (e) {
            e.preventDefault();
        }
        return false;
    }

    function embed(options, self) {
        require(['text!./displaySettings.template.html'], function (template) {
            options.element.innerHTML = globalize.translateDocument(template, 'core');
            options.element.querySelector('form').addEventListener('submit', onSubmit.bind(self));
            if (options.enableSaveButton) {
                options.element.querySelector('.btnSave').classList.remove('hide');
            }
            self.loadData(options.autoFocus);
        });
    }

    function DisplaySettings(options) {
        this.options = options;
        embed(options, this);
    }

    DisplaySettings.prototype.loadData = function (autoFocus) {
        var self = this;
        var context = self.options.element;

        loading.show();

        var userId = self.options.userId;
        var apiClient = connectionManager.getApiClient(self.options.serverId);
        var userSettings = self.options.userSettings;

        return apiClient.getUser(userId).then(function (user) {
            return userSettings.setUserInfo(userId, apiClient).then(function () {
                self.dataLoaded = true;
                loadForm(context, user, userSettings, apiClient);
                if (autoFocus) {
                    focusManager.autoFocus(context);
                }
            });
        });
    };

    DisplaySettings.prototype.submit = function () {
        onSubmit.call(this);
    };

    DisplaySettings.prototype.destroy = function () {
        this.options = null;
    };

    return DisplaySettings;
});
