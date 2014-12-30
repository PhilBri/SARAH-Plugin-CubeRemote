/*__________________________________________________
|                CubeRemote v1.09b                  |
|                                                   |
| Author : Boris Loizeau & Phil Bri (12/2014)       |
|    (See http://encausse.wordpress.com/s-a-r-a-h/) |
| Description :                                     |
|    Canalsat 'Le Cube' Plugin for SARAH project    |
|___________________________________________________|
*/
var cfg;

// Making xml body
function make_CubeBody ( CubeAction, CubeUrn, CubeTag, clbk ) {

    var body  = '<?xml version="1.0" encoding="utf-8"?>'
        body += '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
        body +=   '<s:Body>'
        body +=     '<u:'+ CubeAction +' xmlns:u="urn:'+ CubeUrn +'">'
        body +=       '<uuid>' + cfg.Cube_UUID + '</uuid>';

        while ( typeof CubeTag != 'undefined' && CubeTag.length != 0 ) {
        body +=       '<'+ CubeTag.slice(0,1) +'>' + CubeTag.slice(1,2) + '</'+ CubeTag.shift() +'>'; CubeTag.shift(); }

        body +=       '<executionStatus>0</executionStatus>'
        body +=     '</u:'+ CubeAction +">"
        body +=   '</s:Body>'
        body += '</s:Envelope>\n\r';

        body = body.replace ( 'Code_Appairage', cfg.Code_Appairage );
        clbk ( body );
}

// Write Channels in CubeRemote.xml
function write_XML_Channel ( ttsAction, SpecialAction, Chnl, Id, Loc, cb ) {

    var fs          = require ('fs');
    var file        = __dirname + "\\" + 'cuberemote.xml';
    var xml         = fs.readFileSync ( file, 'utf8' );
    var retXml      = ttsAction;
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

    switch ( SpecialAction ) {
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
function sendCube ( CubeUrl, CubeUrn, CubeAction, CubeResp, sendBody, flag, retCmd ) {

    if ( flag == false ) return retCmd ({ 'retCmd' : 0 });
    var retTab = {};
    var request = require ( 'request' );

    request ({
        uri     :   'http://' + cfg.Cube_IP + ':49152' + CubeUrl,
        method  :   'POST',
        headers : { 'Content-length' :   sendBody.length,
                    'Content-type'   :   'text/xml; charset="utf-8"',
                    'SOAPACTION'     :   '"urn:' + CubeUrn + CubeAction +'"' },
        body    :   sendBody
    }, function ( error , response , retBody ) {

        if ( ! error && response.statusCode == 200 ) {

            retBody = retBody.replace( /&lt;/gm, '<' ).replace( /&gt;/gm, '>' );
            ( retTab['retCmd'] = /<executionStatus>(.*?)<\/executionStatus>/gm.exec( retBody )) ? retTab['retCmd'] = retTab['retCmd'][1] : null;

            while ( CubeResp.length )
                retTab[CubeResp[0]] = ( new RegExp ( '<' + CubeResp[0] + '>(.*?)<\/' + CubeResp.shift() + '>', 'gm' ).exec( retBody )[1]);

            if ( CubeAction == 'RegisterSmartPhone' && cfg.Code_Appairage == '') retTab['erreur'] = 'Code appairage absent';
        } else retTab[ 'erreur' ] = error;

        console.log ( '\nRetour pour "debug" :\r' + retBody + '\n' ); // debug
        retCmd ( retTab );
    });
}

exports.init = function ( SARAH ) {

	var config = SARAH.ConfigManager.getConfig();
	cfg = config.modules.CubeRemote;
	if ( ! cfg.Cube_IP ) return console.log( 'CubeRemote => Config erreur : ip non paramétrée.\r\n' );

	// Finding Cube UUID
	var req = require( 'http' ).get ( 'http://' + cfg.Cube_IP + ':49152/stbdevice.xml', function ( res ) {
		res.setEncoding ( 'utf-8' );
		res.on ( 'data', function ( chunk ) {
			if ( cfg.Cube_UUID = /<UDN>(.*?)<\/UDN>/gmi.exec( chunk ) ) cfg.Cube_UUID = cfg.Cube_UUID[1]
            else return console.log ( '\nCubeRemote => Config erreur : ip incorrecte.' );
		});
    });
    req.on ( 'error', function ( error ) { console.log ( '\nCubeRemote => Erreur de requète : ' + error ); });
}

exports.action = function ( data , callback , config , SARAH ) {

	// config
	if ( ! cfg.Cube_IP ) return callback ({ 'tts' : 'Adresse I P non paramétrée.' });
	if ( ! cfg.Cube_UUID ) return callback ({ 'tts' : 'Adresse I P incorrecte.' });
	console.log ( '\nCubeRemote => Config = ip:' + cfg.Cube_IP + ' ' + cfg.Cube_UUID + '\n' );

	// xml data's
	var CubeUrn     = 'schemas-nds-com:service:' + data.CubeUrnL.split('¤')[0] + '#';
	var CubeUrl     = data.CubeUrnL.split('¤')[1];
	var CubeResp    = data.CubeAction.split('¤');
	var CubeAction  = CubeResp.shift();
	var body;
	
	( typeof data.CubeTag != 'undefined' ) ? CubeTag = data.CubeTag.split('¤') : CubeTag = data.CubeTag ;

	make_CubeBody ( CubeAction, CubeUrn, CubeTag, function ( body ) {

		var retStr = '\nCuberemote => ' + CubeAction + ' ';
		console.log ( 'Sending SOAP ...\r' + body + '\n'); // debug
		( data.SpecialAction == 'deleteAll' ) ? sendFlag = false : sendFlag = true;

		sendCube( CubeUrl, CubeUrn, CubeAction, CubeResp, body, sendFlag, function ( retCmd ) {

			if ( retCmd.erreur ) {
				retStr += retCmd.erreur;
				data.ttsAction = ' La commande a échouée.'
			} else {
				(retCmd.retCmd == 0) ? retStr += '[OK] : ' : retStr += '[' + retCmd.retCmd + '] : ';
				if ( Object.keys(retCmd)[1] != undefined) {
					data.ttsAction = data.ttsAction.replace ( 'x', retCmd[Object.keys(retCmd)[1]] );
                }
				if ( data.SpecialAction ) {
                    write_XML_Channel( data.ttsAction, data.SpecialAction, retCmd.channelNumber ,retCmd.channelListId ,retCmd.locator, function ( retXml ) {
                        data.ttsAction = retXml;
                    });
                }
			}
			console.log ( retStr + data.ttsAction );
			callback ({ 'tts' : data.ttsAction });
		});
	});
}
