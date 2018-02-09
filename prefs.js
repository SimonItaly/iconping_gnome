/* This configuration men was copied and adapted from
 * trifonovkv work.
 * https://github.com/trifonovkv/ping_indicator
 */

const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Lang = imports.lang;

const PING_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.iconping';
const PING_DESTINATION = 'ping-destination';
const REFRESH_INTERVAL = 'refresh-interval';

function init() {}


const PingPrefsWidget = new GObject.Class({
    Name: '.Prefs.Widget',
    GTypeName: 'IconPingExtensionPrefsWidget',
    Extends: Gtk.VBox,

    _init: function(params) {
        this._loadConfig();
        this.parent(params);
        this.margin = 20;
        this.row_spacing = this.column_spacing = 10;
        let row = new Gtk.HBox();
        let label = new Gtk.Label({
            label: "Interval, sec.",
        });
        let ad = new Gtk.Adjustment({
            lower: 1.0,
            step_increment: 1.0,
            upper: 86400.0,
            value: 1.0
        });
        let timeoutSpinButton = new Gtk.SpinButton({
            adjustment: ad,
            digits: 0
        });
        timeoutSpinButton.set_value(this._refreshInterval);
        row.pack_start(label, false, false, 8);
        row.pack_end(timeoutSpinButton, false, false, 8);
        this.pack_start(row, false, false, 8);

        row = new Gtk.HBox();
        label = new Gtk.Label({
            label: "Destination, IP or URL"
        });
        destinationEntry = new Gtk.Entry({
            text: this._pingDestination,
        });
        row.pack_start(label, false, false, 8);
        row.pack_end(destinationEntry, false, false, 8);
        this.pack_start(row, false, false, 8);

        row = new Gtk.HBox();
        submitButton = new Gtk.Button({
            label: "Save"
        });
        submitButton.connect("clicked", Lang.bind(this, function() {
            this._refreshInterval = timeoutSpinButton.value;
            this._pingDestination = destinationEntry.text;
        }));
        row.add(submitButton);
        this.pack_start(row, false, false, 8);
    },

    _loadConfig: function() {
        this._settings = Convenience.getSettings(PING_SETTINGS_SCHEMA);
    },

    get _pingDestination() {
        if (!this._settings)
            this._loadConfig();
        return this._settings.get_string(PING_DESTINATION);
    },

    set _pingDestination(v) {
        if (!this._settings)
            this._loadConfig();
        this._settings.set_string(PING_DESTINATION, v);
    },

    get _refreshInterval() {
        if (!this._settings)
            this._loadConfig();
        return this._settings.get_int(REFRESH_INTERVAL);
    },

    set _refreshInterval(v) {
        if (!this._settings)
            this._loadConfig();
        this._settings.set_int(REFRESH_INTERVAL, v);
    },
});

function buildPrefsWidget() {
    let widget = new PingPrefsWidget();
    widget.show_all();
    return widget;
}
