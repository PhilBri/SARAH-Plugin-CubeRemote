/*__________________________________________________
|                CubeRemote v1.06b                  |
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
	var CubeAction 	= data.CubeAction.split('*')[0];
	var CubeResp 	= (data.CubeAction.split('*').length > 1) ? data.CubeAction.split('*')[1] : '';
	var CubeResp2	= (data.CubeAction.split('*').length > 2) ? data.CubeAction.split('*')[2] : '';
	var CubeResp3	= (data.CubeAction.split('*').length > 3) ? data.CubeAction.split('*')[3] : '';
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

	console.log ('\nCubeAction = ' + CubeAction + ' CubeResp = ' + CubeResp+'\n');

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

			var strRet 	= '\nCubeRemote => Cmd "' + CubeAction + '"';

			if ( ! error && response.statusCode == 200 ) {

				var	body 	= body.replace( /&lt;/gm, '<' ).replace( /&gt;/gm, '>' ),
					ret 	= /<executionStatus>(.*?)<\/executionStatus>/gmi.exec( body ),
					resp 	= new RegExp ( '<' + CubeResp + '>(.*?)<\/' + CubeResp + '>').exec( body );
					resp2 	= new RegExp ( '<' + CubeResp2 + '>(.*?)<\/' + CubeResp2 + '>').exec( body );
					resp3 	= new RegExp ( '<' + CubeResp3 + '>(.*?)<\/' + CubeResp3 + '>').exec( body );

				if ( ret != null ) strRet += ' : Code exec = ' + ret[1];

				if ( CubeResp != '' && resp != null ) {

					if ( CubeResp2 != '' ) {
						strRet = '\nCubeRemote => Chaîne N° : ' + resp3 + ' Locator : ' + resp2 + ' ListId : ' + resp;
					} else {
						data.ttsAction = data.ttsAction.replace ( 'x', resp[1] );
          				strRet += ' : ' + data.ttsAction
          			}
				}
				
			} else {

				strRet += ' : ' + error;
				data.ttsAction = "L'action a échouée";
			}
			console.log ( strRet + '\n' );
			callback ({ 'tts' : data.ttsAction });

			console.log ( '\nRetour pour "debug" :\r' + body + '\n');
		});
	}
}
