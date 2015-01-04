/*__________________________________________________
|                CubeRemote v1.1                    |
|                                                   |
| Author : Boris Loizeau & Phil Bri (12/2014)       |
|    (See http://encausse.wordpress.com/s-a-r-a-h/) |
| Description :                                     |
|    Canalsat 'Le Cube' Plugin for SARAH project    |
|___________________________________________________|
*/
var cfg;
var Cube = {};

// Making xml body
function make_CubeBody ( Cube, clbk ) {

    var body  = '<?xml version="1.0" encoding="utf-8"?>'
        body += '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
        body +=   '<s:Body>'
        body +=     '<u:'+ Cube.Action +' xmlns:u="urn:'+ Cube.Urn +'">'
        body +=       '<uuid>' + Cube.UUID + '</uuid>';

        while ( typeof Cube.Tag != 'undefined' && Cube.Tag.length != 0 ) {
        body +=       '<'+ Cube.Tag.slice(0,1) +'>' + Cube.Tag.slice(1,2) + '</'+ Cube.Tag.shift() +'>'; Cube.Tag.shift(); }

        body +=     '</u:'+ Cube.Action +">"
        body +=   '</s:Body>'
        body += '</s:Envelope>\n\r';

        body = body.replace ( 'Code_Appairage', cfg.Code_Appairage );
        clbk ( body );
}

// Write Channels in CubeRemote.xml
function write_XML_Channel ( Cube, Chnl, Id, Loc, cb ) {

    var fs          = require ('fs');
    var file        = __dirname + "\\" + 'cuberemote.xml';
    var xml         = fs.readFileSync ( file, 'utf8' );
    var retXml      = Cube.ttsAction;
    var tab         = '\r\t\t\t\t';
    var mem_CubeTag = 'out.action.CubeTag = "channelListId¤' + Id + '¤locator¤' + Loc + '¤channelNumber¤' + Chnl + '";';
    var cfg_xml     = tab + '<item>Met la chaîne ' + Chnl
                    + tab + '\t<tag>'
                    + tab + '\t\tout.action.ttsAction = "La chaîne ' + Chnl + ' est affichée";'
                    + tab + '\t\tout.action.CubeUrnL = "Channel-Selection:1¤/ChannelSelectionService/control/";'
                    + tab + '\t\tout.action.CubeAction = "SetSelectedChannel";'
                    + tab + '\t\t'+ mem_CubeTag
                    + tab + '\t</tag>'
                    + tab + '</item>\r';

    switch ( Cube.SpecialAction ) {
        case 'deleteAll' :
            var write_Xml   = xml.replace ( /§[^§]+§/gm, "§ -->\n<!-- §" );
            break;
        case 'saveChannel' :
            if ( xml.match( mem_CubeTag, 'gm' )) retXml = 'La chaîne ' + Chnl + ', est déjà enregistrée.';
            else {
                var pos = xml.search( /<!-- §/gm );
                var write_Xml = xml.slice( 0, pos ) + cfg_xml + xml.slice( pos ); }
            break;
        case 'deleteChannel' :
            if ( xml.match( mem_CubeTag, 'gm' )) {
                var regexp = new RegExp ( '\<item>Met la chaîne '+ Chnl + '[\\s\\S]*?</item>', 'm' );
                var write_Xml = xml.replace(regexp, ''); }
            else retXml = 'La chaîne ' + Chnl + " n'est pas enregistrée.";
            break;
    }
    if ( write_Xml != undefined ) fs.writeFileSync  ( file, write_Xml.replace( /^\s*[\r\n]/gm, '' ), 'utf8' );
    if ( cb ) cb ( retXml );
}

// Sending SOAP request
function sendCube ( Cube, retCmd ) {

    var retTab = {};
    if ( Cube.Action == 'dummy' ) {
        retTab.retCmd = 0;
        return retCmd ( retTab );
    }

    var request = require ( 'request' );

    request ({
        uri     :   'http://' + cfg.Cube_IP + ':49152' + Cube.Url,
        method  :   'POST',
        headers : { 'Content-length' :   Cube.Body.length,
                    'Content-type'   :   'text/xml; charset="utf-8"',
                    'SOAPACTION'     :   '"urn:' + Cube.Urn + Cube.Action +'"' },
        body    :   Cube.Body
    }, function ( error , response , retBody ) {

        if ( ! error && response.statusCode == 200 ) {

            retBody = retBody.replace( /&lt;/gm, '<' ).replace( /&gt;/gm, '>' );
            ( retTab.retCmd = /<executionStatus>(.*?)<\/executionStatus>/gm.exec( retBody )) ? retTab.retCmd = retTab.retCmd[1] : null;

            while ( Cube.Resp.length )
                retTab[Cube.Resp[0]] = ( new RegExp ( '<' + Cube.Resp[0] + '>(.*?)<\/' + Cube.Resp.shift() + '>', 'gm' ).exec( retBody )[1]);
            if ( Cube.Action == 'RegisterSmartPhone' && ! cfg.Code_Appairage ) retTab.retCmd = null;//'Code appairage absent';
        } else retTab.retCmd = null;

        console.log ( '\rRetour pour "debug" :\r' + retBody + '\n' ); // debug
        retCmd ( retTab );
    });
}

exports.init = function ( SARAH ) {

    var config = SARAH.ConfigManager.getConfig();
    cfg = config.modules.CubeRemote;
    if ( ! cfg.Cube_IP ) return console.log ( 'CubeRemote => Config erreur : ip non paramétrée.\n' );

    // Finding Cube UUID
    var req = require( 'http' ).get ( 'http://' + cfg.Cube_IP + ':49152/stbdevice.xml', function ( res ) {
        res.setEncoding ( 'utf-8' );
        res.on ( 'data', function ( chunk ) {
            if ( Cube.UUID = /<UDN>(.*?)<\/UDN>/gmi.exec( chunk ) ) Cube.UUID = Cube.UUID[1]
                else return console.log ( '\nCubeRemote => Config erreur : ip incorrecte / UUID non trouvé.' );
        });
    });
    req.on ( 'error', function ( error ) { console.log ( '\nCubeRemote => Erreur de requète : ' + error ) });
    //req.end();
}

exports.action = function ( data , callback , config , SARAH ) {

    // config
    if ( ! cfg.Cube_IP ) return callback ({ 'tts' : 'Adresse I P non paramétrée.' });
    if ( ! Cube.UUID ) return callback ({ 'tts' : 'Adresse I P incorrecte.' });
    console.log ( '\nCubeRemote => Config = ip:' + cfg.Cube_IP + ' ' + Cube.UUID + '\n' );

    // xml data's
    Cube.Urn           = 'schemas-nds-com:service:' + data.CubeUrnL.split('¤')[0] + '#';
    Cube.Url           = data.CubeUrnL.split('¤')[1];
    Cube.Resp          = data.CubeAction.split('¤');
    Cube.Action        = Cube.Resp.shift();
    Cube.ttsAction     = data.ttsAction;
    Cube.SpecialAction = data.SpecialAction;

    ( data.CubeTag ) ? Cube.Tag = data.CubeTag.split('¤') : Cube.Tag = data.CubeTag ;

    // Main
    make_CubeBody ( Cube, function ( body ) {

        Cube['Body'] = body;
        console.log ( 'Sending SOAP ...\r' + Cube.Body + '\r' ); // debug

        sendCube( Cube, function ( retCmd ) {

            (Cube.SpecialAction) ? logStr = '\nCuberemote => ' + Cube.SpecialAction : logStr = '\nCuberemote => ' + Cube.Action;
            switch (retCmd.retCmd) {
                case null :
                    logStr += '[erreur] : ';
                    Cube.ttsAction = 'La commande a échouée.';
                    break;
                case -1 :
                    logStr += '[' + retCmd.retCmd + '] : ';
                    Cube.ttsAction = 'Le Cube n\'est pas appairé.';
                    break;
                default :
                    logStr += ' [OK] : ';
                    if ( Object.keys(retCmd)[1] != undefined)
                        Cube.ttsAction = Cube.ttsAction.replace ( 'x', retCmd[Object.keys( retCmd )[1]] );
                    if ( Cube.SpecialAction )
                        write_XML_Channel( Cube, retCmd.channelNumber ,retCmd.channelListId ,retCmd.locator, function ( retXml ) {
                            Cube.ttsAction = retXml });
            }
            console.log ( logStr + Cube.ttsAction );
            callback ({ 'tts' : Cube.ttsAction });
		});
	});
}
