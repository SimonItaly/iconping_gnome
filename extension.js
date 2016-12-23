
const St = imports.gi.St;
const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Util = imports.misc.util;

let button;

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

		let icon = new St.Icon({style_class: 'iconok'})
		button.set_child(icon);

        /*
        let item;
        
        item = new PopupMenu.PopupMenuItem(_("Update time:"));
        this.menu.addMenuItem(item);
        
        item = new PopupMenu.PopupMenuItem(_("1 second"));
        item.connect('activate', Lang.bind(this, this._onPreferencesActivate));
        this.menu.addMenuItem(item);
        
        item = new PopupMenu.PopupMenuItem(_("5 second"));
        item.connect('activate', Lang.bind(this, this._onPreferencesActivate));
        this.menu.addMenuItem(item);
        
        item = new PopupMenu.PopupMenuItem(_("30 second"));
        item.connect('activate', Lang.bind(this, this._onPreferencesActivate));
        this.menu.addMenuItem(item);
        
        item = new PopupMenu.PopupMenuItem(_("Exit"));
        item.connect('activate', Lang.bind(this, this._onPreferencesActivate));
        this.menu.addMenuItem(item);
        */

        this._refresh();
    },

    _loadConfig: function()
    {

    },

    _onPreferencesActivate: function()
    {
		log("_onPreferencesActivate");
        return 0;
    },

    _loadData: function()
    {
        this.command = ["ping", "-c 1", "8.8.8.8"];
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
            Lang.bind(this, this._loadPipeOUT),
            null
        );

        this.tagWatchERR = GLib.io_add_watch(this.IOchannelERR, GLib.PRIORITY_DEFAULT,
            GLib.IOCondition.IN | GLib.IOCondition.HUP,
            Lang.bind(this, this._loadPipeERR),
            null
        );
    },

    _loadPipeOUT: function(channel, condition, data)
    {
        if (condition != GLib.IOCondition.HUP)
        {
            let [size, out] = channel.read_to_end(null);
            
            let result = out.toString().match(/time=(\d*.*)\ ms/m);

            if(result != null)
            {
            	let icon;
            	
            	var ping = parseFloat(result[1]);
            	if(ping >= 300.0)
            	{
            		icon = new St.Icon({style_class: 'iconslow'});	
            	}
            	else
            	{
            		icon = new St.Icon({style_class: 'iconok'});
            	}
            	
            	button.set_child(icon);
        	}
        }
        GLib.source_remove(this.tagWatchOUT);
        channel.shutdown(true);
    },

    _loadPipeERR: function(channel, condition, data)
    {
        if (condition != GLib.IOCondition.HUP)
        {
            let icon = new St.Icon({style_class: 'iconko'});
            button.set_child(icon);
        }
        GLib.source_remove(this.tagWatchERR);
        channel.shutdown(false);
    },

    _refresh: function()
    {
        this._removeTimeout();
        if (this.child_pid === undefined)
        {
            this._loadData();
        }
        else
        {
            let icon = new St.Icon({style_class: 'iconko'});
            button.set_child(icon);
        }
        this._timeout = Mainloop.timeout_add_seconds(5,
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
