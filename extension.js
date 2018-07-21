
const St = imports.gi.St;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

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
    },

	/*
		Still not working
	*/
    toggleState: function()
    {
        if(status)
        {
            //this.createPingIcon('icon');
            
            //this._timeout = undefined;

            //Main.notify(_("Iconping disabled"));
            status = 0;
        }
        else
        {
            //this.createPingIcon('iconok');
            
            //this._refresh();
            
            //this._timeout = Mainloop.timeout_add_seconds(1,
            //    Lang.bind(this, this._refresh));

            //Main.notify(_("Iconping enabled"));
            status = 1;
        }
    },

	/*
		Create the icon	
	*/
    createPingIcon: function(name)
    {
        let icon = new St.Icon({style_class: name});
        button.set_child(icon);

        //button.connect('button-press-event', this.toggleState);
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
