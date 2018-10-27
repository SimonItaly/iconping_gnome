/* 
 * Iconping GNOME Shell extension
 *
 * Author: Simone Bisi <https://github.com/SimonItaly>
 *
 * Thanks to:
 * 		https://github.com/antirez/iconping (idea and original work for macOS)
 * 		https://github.com/JocelynDelalande (added options menu)
 * 		https://github.com/mgafner (fixed warnings)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const St = imports.gi.St;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const PopupMenu = imports.ui.popupMenu;
const MessageTray = imports.ui.messageTray;

let button;
let status = 1;

const ICONPING_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.iconping';
const PING_DESTINATION = 'ping-destination';
const REFRESH_INTERVAL = 'refresh-interval';

const PingMenuButton = new Lang.Class(
{
    Name: 'PingMenuButton',
    Extends: PanelMenu.Button,

    _init: function()
    {
        this.parent(0.0, 'IconPing', false);
        
		button = new St.Bin({ style_class: 'panel-button',
                          reactive: true,
                          can_focus: true,
                          x_fill: true,
                          y_fill: false,
                          track_hover: true });                     

		this.createPingIcon('icon');

        this._settings = Convenience.getSettings(ICONPING_SETTINGS_SCHEMA);
        this._settingsC = this._settings.connect("changed", Lang.bind(this, function() {
          this._loadConfig();
        }));
        this._loadConfig();
        this._refresh();

		button.reactive = true;
		button.connect('button-release-event', this.toggleState);

		global.log('[iconPing] Iconping init');
    },

	/*
		Toggle iconping
	*/
    toggleState: function()
    {
        if(status)
        {
            let icon = new St.Icon({style_class: 'icon'});
        	button.set_child(icon);

            stop();

            status = 0;
            notify("Iconping", "Iconping disabled", 'media-playback-pause');

			global.log('[iconping] Iconping disabled');
        }
        else
        {
			start();

            status = 1;
            notify("Iconping", "Iconping enabled", 'media-playback-start');

			global.log('[iconping] Iconping enabled');
        }
    },

	/*
		Create the icon	
	*/
    createPingIcon: function(name)
    {
        let icon = new St.Icon({style_class: name});
        button.set_child(icon);
    },

    /*
         (re) load settings from gconf
     */
    _loadConfig: function() {
        this._pingDestination = this._settings.get_string(PING_DESTINATION);
        this._pingInterval = this._settings.get_int(REFRESH_INTERVAL);
    },

	/*
		Ping magic stolen from another extension
	*/
    _loadData: function()
    {
        this.command = ["ping", "-c 1", this._pingDestination];
        [success, this.child_pid, this.std_in, this.std_out, this.std_err] =
        GLib.spawn_async_with_pipes(
            null, 
            this.command, 
            null,
            GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
            null);

        if (!success)
        {
            return;
        }

        this.IOchannelIN = GLib.IOChannel.unix_new(this.std_in);
        this.IOchannelOUT = GLib.IOChannel.unix_new(this.std_out);
        this.IOchannelERR = GLib.IOChannel.unix_new(this.std_err);
        
        this.IOchannelIN.shutdown(false);        
        
        this.tagWatchChild = GLib.child_watch_add(GLib.PRIORITY_DEFAULT, this.child_pid,
            Lang.bind(this, function(pid, status, data) {
                GLib.source_remove(this.tagWatchChild);
                GLib.spawn_close_pid(pid);
                this.child_pid = undefined;
            })                
        );

        this.tagWatchOUT = GLib.io_add_watch(this.IOchannelOUT, GLib.PRIORITY_DEFAULT,
            GLib.IOCondition.IN | GLib.IOCondition.HUP,
            Lang.bind(this, this._loadPipeOUT)
        );

        this.tagWatchERR = GLib.io_add_watch(this.IOchannelERR, GLib.PRIORITY_DEFAULT,
            GLib.IOCondition.IN | GLib.IOCondition.HUP,
            Lang.bind(this, this._loadPipeERR)
        );
    },

	/*
		Handle correct response -> green/yellow icon
	*/
    _loadPipeOUT: function(channel, condition, data)
    {
        if (condition != GLib.IOCondition.HUP)
        {
            let [size, out] = channel.read_to_end();
            
            let result = out.toString().match(/time=(\d*.*)\ ms/m);

            if(result != null)
            {
            	var ping = parseFloat(result[1]);
            	if(ping >= 300.0)
            	{
                    this.createPingIcon('iconslow');
            	}
            	else
            	{
                    this.createPingIcon('iconok');
            	}
        	}
        }
        GLib.source_remove(this.tagWatchOUT);
        channel.shutdown(true);
    },

	/*
		Handling network error -> red icon
	*/
    _loadPipeERR: function(channel, condition, data)
    {
        if (condition != GLib.IOCondition.HUP)
        {
            this.createPingIcon('iconko');
        }
        GLib.source_remove(this.tagWatchERR);
        channel.shutdown(false);
    },

	/*
		Timer
	*/
    _refresh: function()
    {
        this._removeTimeout();
        if (this.child_pid === undefined)
        {
            this._loadData();
        }
        else
        {
            this.createPingIcon('iconko');
        }

        this._timeout = Mainloop.timeout_add_seconds(this._pingInterval,
            Lang.bind(this, this._refresh));

        return true;
    },

    _removeTimeout: function()
    {
        if (this._timeout !== undefined)
        {
            Mainloop.source_remove(this._timeout);
            this._timeout = undefined;
        }
    },

    stop: function()
    {
        this._removeTimeout();
        if (this._settingsC) {
            this._settings.disconnect(this._settingsC);
            this._settingsC = undefined;
        }
        this.menu.removeAll();
    }
})

let pingMenu;

function enable()
{
    pingMenu = new PingMenuButton;
    Main.panel._rightBox.insert_child_at_index(button, 0);
}

function disable()
{
	Main.panel._rightBox.remove_child(button);
    pingMenu.stop();
    pingMenu.destroy();
}

/*
	There's probably a more elegant way for the toggle function,
	but here's a quick and dirty fix 
*/

function start() {
	pingMenu._refresh();
}

function stop() {
	pingMenu._removeTimeout();
}

//==============================================================================

function notify(msg, details, icon) {
    let source = new MessageTray.Source("MyApp Information", icon);
    Main.messageTray.add(source);
    let notification = new MessageTray.Notification(source, msg, details);
    notification.setTransient(true);
    source.notify(notification);
}

