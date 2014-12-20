/*__________________________________________________
|                CubeRemote v1.04b                  |
|                                                   |
| Author : Boris Loizeau & Phil Bri (12/2014)       |
|    (See http://encausse.wordpress.com/s-a-r-a-h/) |
| Description :                                     |
|    Canalsat 'Le Cube' Plugin for SARAH project    |
|___________________________________________________|
*/

var cfg;

exports.init = function ( SARAH ) {
	var config = SARAH.ConfigManager.getConfig();
	cfg = config.modules.CubeRemote;

	if ( ! cfg.Cube_IP ) return console.log( 'CubeRemote => Config [ERREUR] : ip non paramétrée !\r\n' );

	// Finding Cube UUID :8080/BasicDeviceDescription.xml 	:49152/stbdevice.xml
	var req = require( 'http' ).get ( 'http://' + cfg.Cube_IP + ':49152/stbdevice.xml', function ( res ) {
		res.setEncoding ( 'utf-8' );

		res.on ( 'data', function ( chunk ) {

			cfg.Cube_UUID = /<UDN>(.*?)<\/UDN>/gmi.exec( chunk )[1];
			console.log ( '\nCubeRemote => Config [OK] : \rIP = ' + cfg.Cube_IP + ' \rUUID = ' + cfg.Cube_UUID + '\n' );
		});
    });

    req.on ( 'error', function ( error ) { console.log ( '\nCubeRemote => Config [ERREUR] : [ip Incorrecte]' );});
}

exports.action = function ( data , callback , config , SARAH ) {

	if ( ! cfg.Cube_IP ) return callback ({ 'tts' : 'Adresse I P non paramétrée' });
	if ( ! cfg.Cube_UUID ) {

		console.log ( '\nCubeRemote => Config [ERREUR] : UUID absent = Erreur ip ou Cube incompatible !' );
		return callback ({ 'tts' : 'I P incorrecte ou Cube incompatible avec SARAH' });
	}

	// Making xml body
	var CubeUrn 	= 'schemas-nds-com:service:' + data.CubeUrnL.split('*')[0] + '#';
	var CubeUrl 	= data.CubeUrnL.split('*')[1];
	//if (data.CubeAction) {
	var CubeAction 	= data.CubeAction.split('*')[0];
	var CubeResp 	= data.CubeAction.split('*')[1];//}
	var body;
	
	if ( typeof data.CubeTag != 'undefined') var CubeTag = data.CubeTag.split('*');

	body  = '<?xml version="1.0" encoding="utf-8"?>'
	body += '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
	body +=		'<s:Body>'
	body +=			'<u:'+ CubeAction +' xmlns:u="urn:'+ CubeUrn +'">'
	body +=				'<uuid>' + cfg.Cube_UUID + '</uuid>';

	while ( typeof CubeTag != 'undefined' && CubeTag.length != 0 ) {
	body +=				'<'+ CubeTag.slice(0,1) +'>' + CubeTag.slice(1,2) + '</'+ CubeTag.shift() +'>'; CubeTag.shift(); }

	body +=				'<executionStatus>0</executionStatus>'
	body +=			'</u:'+ CubeAction +">"
	body +=		'</s:Body>'
	body +=	'</s:Envelope>\n\r';

	body = body.replace ( 'Code_Appairage', cfg.Code_Appairage );

	console.log ( 'http://' + cfg.Cube_IP + ':49152' + CubeUrl );
	console.log ( '"urn:' + CubeUrn + CubeAction + '"' );
	console.log ( '\n' + body + '\n');

	//return;// callback ({ 'tts' : 'ok'}); // for test only
	SendCube ();

	// Sending SOAP request
	function SendCube () {
		var request = require ( 'request' );

		request ({
			uri	    : 	'http://' + cfg.Cube_IP + ':49152' + CubeUrl,
			method  : 	'POST',
			headers : {	'Content-length' :   body.length,
						'Content-type'	 :   'text/xml; charset="utf-8"',
						'SOAPACTION'	 :   '"urn:' + CubeUrn + CubeAction +'"' },
			body	: 	body

		}, function ( error , response , body ) {

			if ( ! error && response.statusCode == 200 ) {

				var strRet 	= '\nCubeRemote => Commande "' + CubeAction + '"',
					body 	= body.replace( /&lt;/gm, '<' ).replace( /&gt;/gm, '>' ),
					ret 	= /<executionStatus>(.*?)<\/executionStatus>/gmi.exec( body ),
					ret2 	= new RegExp ( '<' + CubeResp + '>(.*?)<\/' + CubeResp + '>').exec( body );

				if ( ret != null ) strRet += ' : Code exec = ' + ret[1];

				if ( typeof CubeResp != 'undefined' && ret2 != null ) {
          			strRet += ' : Retour cmd = ' + ret2[1];
					return callback ({ 'tts' : data.ttsAction.replace ( 'x', ret2[1] ) });
				}
				console.log (strRet);
				callback ({ 'tts' : data.ttsAction });
			} else {

				console.log ( '\nCubeRemote => Commande "' + CubeAction + '" = ' + error + '\n' );
				callback ({ 'tts': "L'action a échouée" });
			}
		});
	}
}
