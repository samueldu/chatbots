<?php

class Controller_Admin2_Api_Bot extends Controller_Rest {

    public $_sender       = null;
    public $_debug        = false;
    public $_latlng       = null;
    public $_postcode     = null;
    public $_source_multi = FALSE;

    public function post_coming() {
        $sKey       = "bot_coming";
        $bBotComing = (bool) Model_Config::get_value($sKey, false);
        Model_Config::updateConfig($sKey, !$bBotComing);
        return $this->response(array(
                    'status'  => 'success',
                    'message' => 'Atualizado com sucesso'
        ));
    }

    public function action_index() {

        if (Model_Config::get_value("bot_status") == 1) {

            $hub_verify_token = null;

            //-----VEFICA O WEBHOOK-----//
            if (isset($_REQUEST['hub_challenge'])) {
                $challenge        = $_REQUEST['hub_challenge'];
                $hub_verify_token = $_REQUEST['hub_verify_token'];
                if ($hub_verify_token === Model_Config::get_value('bot_verify_token')) {
                    echo $challenge;
                }
            }
            //-----FIM VERIFICAÇÃO-----//

            $update_response = file_get_contents("php://input");
            $update          = json_decode($update_response, true);
            if (isset($update['entry'][0]['messaging'][0])) {
                $this->_processMessage($update['entry'][0]['messaging'][0]);
            }
        }
    }

    private function _processMessage($message) {
        $this->_logDebug($message, "INPUT_MESSAGE");

        $payload = "PAYLOAD_DEFAULT";

        $this->_source_multi = isset($message['source']) ? true : false;

        //pega o sender_id
        $this->_sender = $message['sender']['id'];
        \Model_Botuserid::upsert($this->_sender);

        //se for uniloja, apresentar as opções de loja
        $show_units = Model_Config::get_value('show_units', 'none');
        if ($show_units == 'multiple') {
            $this->_source_multi = true;
            //verificar se o cliente já selecionou a unidade
            $payload             = $this->_getPayloadFromMultipleStore($message);
        }

        if ($payload != "PAYLOAD_MULTIPLE_STORES" && $payload != "PAYLOAD_GREETINGS") {

            //POSTBACK_*
            if (isset($message['postback'])) {
                $payload = $message['postback']['payload'];
            }
            //PAYLOAD_*
            elseif (isset($message['message'])) {
                if (isset($message['message']['quick_reply'])) {
                    $payload = $message['message']['quick_reply']["payload"];
                }
                elseif (isset($message['message']['text'])) {
                    $payload = $this->_getPayloadFromUserText($message['message']['text']);
                }
                elseif (isset($message['message']['attachments'][0]['payload']['coordinates'])) {
                    $payload       = "ANSWER_DELIVERY_GEOLOCATION";
                    $this->_latlng = array(
                        $message['message']['attachments'][0]['payload']['coordinates']['lat'],
                        $message['message']['attachments'][0]['payload']['coordinates']['long']
                    );
                }
            }
            else {
                $payload = "PAYLOAD_DEFAULT";
            }
        }

        if (!is_array($payload)) {
            $this->_logDebug($payload, "SWITCH");
            switch ($payload) {
                case "PAYLOAD_MULTIPLE_STORES":
                    $this->_process_multiple_stores();
                    break;
                case "PAYLOAD_GETSTARTED":
                    $this->_process_get_started();
                    break;
                case "PAYLOAD_OTHERS":
                    $this->_process_others();
                    break;
                case "PAYLOAD_GREETINGS":
                    $this->_process_greetings();
                    break;
                //webview
                case "PAYLOAD_ORDER":
                    $this->_process_order();
                    break;
                case "PAYLOAD_PRICES":
                    $this->_process_prices();
                    break;
                case "PAYLOAD_CONTACT":
                    $this->_process_contact();
                    break;
                case "PAYLOAD_LOYALTY":
                    $this->_process_loyalty();
                    break;
                case "PAYLOAD_MENU":
                    $this->_process_menu();
                    break;
                //db
                case "PAYLOAD_WORKING_TIME":
                    $this->_process_working_time();
                    break;
                case "PAYLOAD_DELIVERY_TIME":
                    $this->_process_delivery_time();
                    break;
                case "PAYLOAD_PAYMENT":
                    $this->_process_payment();
                    break;
                //verifica a forma de delivery e apresenta as opções de escolha
                case "PAYLOAD_DELIVERY":
                    $this->_process_delivery();
                    break;
                //usuário informou geolocation
                case "ANSWER_DELIVERY_GEOLOCATION":
                    $this->_answer_delivery_geolocation();
                    break;
                //usuário informou o cep
                case "ANSWER_DELIVERY_POSTCODE":
                    $this->_answer_delivery_postcode();
                    break;
                //default
                case "PAYLOAD_DEFAULT":
                    $this->_process_default();
                    break;
                default:
                    $this->_process_dynamic_payload($payload);
                    break;
            }
        }
        //vai para o menu de opções gerais (PAYLOAD_OTHERS)
        else {
            $this->_process_many_payloads($payload);
        }
        die;
    }

    private function _getPayloadFromMultipleStore($message) {
        //verificar se o usuario já tem url atribuida
        $url_unity = \Model_Botuserid::find($this->_sender);
        if (!is_null($url_unity->url_unity)) {
            if ($message['postback']['payload'] == "PAYLOAD_MULTIPLE_STORES") {
                \Model_Botuserid::getOrUpsert($this->_sender, NULL);
                return "PAYLOAD_MULTIPLE_STORES";
            }
            if ($url_unity->url_unity == Model_Config::get_value('bot_base_url')) {
                return "PAYLOAD_LOCAL";
            }
            else {
                $this->_callExternalBot($url_unity->url_unity, $message);
                exit;
            }
        }
        else {
            $check_if_url = $this->_checkIfUrl($message);
            if ($check_if_url['is_url']) {
                if ($check_if_url['url'] == Model_Config::get_value('bot_base_url')) {
                    return "PAYLOAD_GREETINGS";
                }
                else {
                    //trocar mensagem por greetings
                    $message['postback']['payload'] = "PAYLOAD_GREETINGS";
                    $this->_callExternalBot($check_if_url['url'], $message);
                    exit;
                }
            }
            else {
                return "PAYLOAD_MULTIPLE_STORES";
            }
        }
    }

    private function _checkIfUrl($sText) {
        //verificar se o payload é uma URL: 
        $input_text       = false;
        $return           = array();
        $return['is_url'] = false;
        $return['url']    = false;
        //verifica se o texto veio por quick_reply ou button (payload)
        if (isset($sText['message']['quick_reply'])) {
            $input_text = $sText['message']['quick_reply']["payload"];
        }
        elseif (isset($sText['postback'])) {
            $input_text = $sText['postback']['payload'];
        }
        $return['url'] = $input_text;
        if (filter_var($input_text, FILTER_VALIDATE_URL)) {
            //atribui a URL ao usuário
            \Model_Botuserid::getOrUpsert($this->_sender, $input_text);
            $return['is_url'] = true;
        }
        return $return;
    }

    private function _getPayloadFromUserText($sText) {
        //1 - verificar se o texto é um payload 
        if (strstr($sText, "PAYLOAD")) {
            return $sText;
        }
        //2 - verificar se é um CEP
        $cep = preg_replace("/([^\d]*)/", "", $sText);
        if (strlen($cep) == 8) {
            $this->_postcode = $cep;
            return "ANSWER_DELIVERY_POSTCODE";
        }

        //3 - faz um slug do texto e busca as palavras relacionadas ao texto
        $sText = Controller_Penknife::slug($sText);
        if ($sText != "") {
            //remover os pronomes do texto
            $aText  = Controller_Penknife::removePronouns($sText);
            $result = false;
            if (!empty($aText)) {
                $result = \Model_Botcard::getCardFromKeywords($aText);

                if (sizeof($result) == 1) {
                    return $result[0]['payload'];
                }
                elseif (sizeof($result) > 1) {
                    $aReturn = array();
                    foreach ($result as $payload) {
                        $aReturn[] = $payload['payload'];
                    }
                    return $aReturn;
                }
                else {
                    //busca por saudação
                    $greeting = Controller_Penknife::getGreetings($aText);
                    if ($greeting) {
                        return "PAYLOAD_GREETINGS";
                    }
                }
            }
        }

        //salva a palavra como não reconhecida
        $botlog             = new \Model_Botlog();
        $botlog->user_id    = $this->_sender;
        $botlog->log        = $sText;
        $botlog->created_at = date("Y-m-d H:i:s");
        $botlog->save();

        return "PAYLOAD_DEFAULT";
    }

    /**
     * PROCESSAMENTO DE PAYLOADS
     * *************************************************************************
     */
    private function _process_multiple_stores() {
        //pega a lista de unidades
        $units = Model_Config::get_value('units');
        $units = array_values($units);

        if (count($units) > 0) {
            //verificar quais unidades tem o chatbot ativo
            foreach ($units as $k => $unit) {
                if (!isset($unit['chatbot']) || (isset($unit['chatbot']) && @$unit['chatbot'] == 0)) {
                    unset($units[$k]);
                }
            }
            
            //reseta as chaves
            $units = array_values($units);
            
            //se a quantidade for maior que 1, exibir menu
            if (count($units) > 1) {
                $card = \Model_Botcard::getByPayload("PAYLOAD_MULTIPLE_STORES");

                //botões verticais
                if (count($units) <= 3) {
                    $parameters         = array();
                    $parameters["text"] = $card['message_fixed'] . "\n";
                    if ($card['show_message_custom']) {
                        $parameters["text"] .= $card['message_custom'] . "\n";
                    }

                    $button = array();
                    foreach ($units as $key => $unit) {
                        $button[$key]["type"]    = "postback";
                        $button[$key]["title"]   = substr($unit['name'], 0, 20);
                        $button[$key]["payload"] = str_replace("/front", "", $unit['url']);
                    }
                    $parameters["buttons"] = $button;
                    //insere os botões 
                    return $this->_sendMessage($parameters);
                }
                //botões horizontais
                else {
                    $content                    = array();
                    $content["messaging_type"]  = "RESPONSE";
                    $content["recipient"]["id"] = $this->_sender;
                    $content["message"]         = array();
                    $content["message"]["text"] = $card['message_fixed'] . "\n";
                    if ($card['show_message_custom']) {
                        $content["message"]["text"] .= $card['message_custom'] . "\n";
                    }

                    foreach ($units as $key => $unit) {
                        $button[$key]["content_type"]        = "text";
                        $button[$key]["title"]               = substr($unit['name'], 0, 20);
                        $button[$key]["payload"]             = str_replace("/front", "", $unit['url']);
                        $content["message"]["quick_replies"] = $button;
                    }

                    return \Controller_Penknife::callFacebook($content, Model_Config::get_value('bot_api_url_messages'));
                }                
            }
            //se a quantidade for igual a 1, atribuir a única loja ao usuario
            elseif (count($units) == 1) {
                \Model_Botuserid::getOrUpsert($this->_sender, str_replace("/front", "", $units[0]['url']));
                $this->_source_multi = false;
                $this->_process_get_started();
                return;
            }
        }
        //se a quantidade for igual a 0, mostrar mensagem de não entendi (todo: verificar o que se deve fazer nesta situação)
        $this->_process_others();
        return;
    }

    private function _process_dynamic_payload($payload) {
        $card = \Model_Botcard::getByPayload($payload);

        $parameters            = array();
        $parameters["text"]    = $card['message_fixed'] . "\n" . $card['message_custom'] . "\n";
        //atribuição de botões
        $buttons[]             = $this->_button_webview("Pedido Online");
        $buttons[]             = $this->_button_others();
        //insere os botões 
        $parameters["buttons"] = $buttons;
        return $this->_sendMessage($parameters);
    }

    private function _process_get_started() {
        $card = \Model_Botcard::getByPayload("PAYLOAD_GETSTARTED");

        $parameters         = array();
        $parameters["text"] = $card['message_fixed'] . "\n";
        if ($card['show_message_custom']) {
            $parameters["text"] .= $card['message_custom'] . "\n";
        }
        //atribuição de botões
        $buttons[] = $this->_button_webview("Pedido Online");
        $buttons[] = $this->_button_others();
        if ($this->_source_multi) {
            $buttons[] = $this->_button_change_store();
        }
        //insere os botões 
        $parameters["buttons"] = $buttons;
        return $this->_sendMessage($parameters);
    }

    private function _process_others() {
        $card = \Model_Botcard::getByPayload("PAYLOAD_OTHERS");

        $content                    = array();
        $content["messaging_type"]  = "RESPONSE";
        $content["recipient"]["id"] = $this->_sender;
        $content["message"]         = array();
        $content["message"]["text"] = $card['message_fixed'] . "\n";
        if ($card['show_message_custom']) {
            $content["message"]["text"] .= $card['message_custom'] . "\n";
        }
        $content["message"]["quick_replies"] = $this->_get_quick_replies_buttons();
        $callFacebook                        = \Controller_Penknife::callFacebook($content, Model_Config::get_value('bot_api_url_messages'));
        $this->_logDebug($callFacebook, "CALLFACEBOOK");
    }

    private function _process_greetings() {
        $card               = \Model_Botcard::getByPayload("PAYLOAD_GREETINGS");
        $parameters         = array();
        $parameters["text"] = $card['message_fixed'] . "\n";
        if ($card['show_message_custom']) {
            $parameters["text"] .= $card['message_custom'] . "\n";
        }
        //atribuição de botões
        $buttons[] = $this->_button_webview("Pedido Online");
        $buttons[] = $this->_button_others();
        if ($this->_source_multi) {
            $buttons[] = $this->_button_change_store();
        }
        //insere os botões 
        $parameters["buttons"] = $buttons;
        return $this->_sendMessage($parameters);
    }

    private function _process_many_payloads($aPayloads = array()) {
        $card                       = \Model_Botcard::getByPayload("PAYLOAD_DEFAULT");
        $content                    = array();
        $content["messaging_type"]  = "RESPONSE";
        $content["recipient"]["id"] = $this->_sender;
        $content["message"]         = array();
        $content["message"]["text"] = $card['message_fixed'] . "\n";
        if ($card['show_message_custom']) {
            $content["message"]["text"] .= $card['message_custom'] . "\n";
        }

        $content["message"]["quick_replies"] = $this->_get_quick_replies_buttons_by_payload($aPayloads);
        \Controller_Penknife::callFacebook($content, Model_Config::get_value('bot_api_url_messages'));
    }

    private function _process_default() {
        $card = \Model_Botcard::getByPayload("PAYLOAD_DEFAULT");

        $content                    = array();
        $content["messaging_type"]  = "RESPONSE";
        $content["recipient"]["id"] = $this->_sender;
        $content["message"]         = array();
        $content["message"]["text"] = $card['message_fixed'] . "\n";
        if ($card['show_message_custom']) {
            $content["message"]["text"] .= $card['message_custom'] . "\n";
        }
        $content["message"]["quick_replies"] = $this->_get_quick_replies_buttons();
        \Controller_Penknife::callFacebook($content, Model_Config::get_value('bot_api_url_messages'));
    }

    private function _get_quick_replies_buttons($aWords = array()) {
        $options = \Model_Botcard::getByQuickReplies($aWords);
        $button  = array();
        if (!empty($options)) {
            foreach ($options as $key => $option) {
                $button[$key]["content_type"] = "text";
                $button[$key]["title"]        = $option['title'];
                $button[$key]["payload"]      = $option['payload'];
            }
        }
        return $button;
    }

    private function _get_quick_replies_buttons_by_payload($aPayloads) {
        $button = array();
        foreach ($aPayloads as $key => $payload) {
            $card                         = \Model_Botcard::getByPayload($payload);
            $button[$key]["content_type"] = "text";
            $button[$key]["title"]        = $card['title'];
            $button[$key]["payload"]      = $card['payload'];
        }
        return $button;
    }

    private function _process_order() {
        $card = \Model_Botcard::getByPayload("PAYLOAD_ORDER");

        $parameters         = array();
        $parameters["text"] = $card['message_fixed'] . "\n";
        if ($card['show_message_custom']) {
            $parameters["text"] .= $card['message_custom'] . "\n";
        }
        //atribuição de botões
        $buttons[]             = $this->_button_webview($card['title']);
        //insere os botões 
        $parameters["buttons"] = $buttons;
        return $this->_sendMessage($parameters);
    }

    private function _process_prices() {
        $card = \Model_Botcard::getByPayload("PAYLOAD_PRICES");

        $parameters         = array();
        $parameters["text"] = $card['message_fixed'];
        if ($card['show_message_custom']) {
            $parameters["text"] .= "\n" . $card['message_custom'] . "\n";
        }
        //atribuição de botões
        $buttons[]             = $this->_button_webview($card['title']);
        //insere os botões 
        $parameters["buttons"] = $buttons;
        return $this->_sendMessage($parameters);
    }

    private function _process_contact() {
        $card = \Model_Botcard::getByPayload("PAYLOAD_CONTACT");

        $parameters         = array();
        $parameters["text"] = $card['message_fixed'] . "\n";
        if ($card['show_message_custom']) {
            $parameters["text"] .= $card['message_custom'] . "\n";
        }
        //atribuição de botões
        $buttons[]             = $this->_button_webview($card['title'], "/front/sobre");
        //insere os botões 
        $parameters["buttons"] = $buttons;
        return $this->_sendMessage($parameters);
    }

    private function _process_loyalty() {
        $card = \Model_Botcard::getByPayload("PAYLOAD_LOYALTY");

        $parameters         = array();
        $parameters["text"] = $card['message_fixed'] . "\n";
        if ($card['show_message_custom']) {
            $parameters["text"] .= $card['message_custom'] . "\n";
        }
        //atribuição de botões
        $buttons[]             = $this->_button_webview($card['title'], "/front/fidelidade/regulamento");
        //insere os botões 
        $parameters["buttons"] = $buttons;
        return $this->_sendMessage($parameters);
    }

    private function _process_menu() {
        $card = \Model_Botcard::getByPayload("PAYLOAD_MENU");

        $parameters         = array();
        $parameters["text"] = $card['message_fixed'] . "\n";
        if ($card['show_message_custom']) {
            $parameters["text"] .= $card['message_custom'] . "\n";
        }
        //atribuição de botões
        $buttons[]             = $this->_button_webview($card['title'], "/front");
        //insere os botões 
        $parameters["buttons"] = $buttons;
        return $this->_sendMessage($parameters);
    }

    private function _process_working_time() {
        $card   = \Model_Botcard::getByPayload("PAYLOAD_WORKING_TIME");
        $isOpen = \Front\Model\Config::getStoreOpen();

        $parameters         = array();
//        $parameters["text"] = strtoupper($isOpen['sString']) . "\n\n" . $card['message_fixed'] . "\n";
        $parameters["text"] = $card['message_fixed'] . "\n";
        if ($card['show_message_custom']) {
            $parameters["text"] .= $card['message_custom'] . "\n";
        }
        if ($card['show_message_processed']) {
            //busca pelos horários de atendimento no banco
            $workingTime = \Front\Model\Config::getStoreTimeOperation();
            if (!empty($workingTime)) {
                foreach ($workingTime['times'] as $dow => $time) {
                    $parameters["text"] .= $dow . ": " . $time . "\n";
                }
            }
        }
        $buttons[]             = $this->_button_webview("Pedido Online");
        $buttons[]             = $this->_button_others();
        //insere os botões 
        $parameters["buttons"] = $buttons;

        return $this->_sendMessage($parameters);
    }

    private function _process_delivery_time() {
        $card = \Model_Botcard::getByPayload("PAYLOAD_DELIVERY_TIME");

        $parameters         = array();
        $parameters["text"] = $card['message_fixed'] . "\n";
        if ($card['show_message_custom']) {
            $parameters["text"] .= $card['message_custom'] . "\n";
        }
        if ($card['show_message_processed']) {
            $deadline        = Model_Config::get_value('deadline',0);
            $deadlineDesk    = Model_Config::get_value('deadlineDesk',0);
            $deadlineMax     = Model_Config::get_value('deadlineMax',0);
            $deadlineDeskMax = Model_Config::get_value('deadlineDeskMax',0);

            if ((int) $deadline > 0 && (int) $deadlineMax > 0) {
                $parameters["text"] .= "Tempo de entrega é de " . $deadline . " até ".$deadlineMax." minutos.\n";
            }
            elseif ((int) $deadline > 0 && (int) $deadlineMax <= 0) {
                $parameters["text"] .= "Tempo mínimo de entrega: " . $deadline . " minutos.\n";
            }
            elseif ((int) $deadline <= 0 && (int) $deadlineMax > 0) {
                $parameters["text"] .= "Tempo máximo de entrega: " . $deadlineMax . " minutos.\n";
            }
            
            if ((int) $deadlineDesk > 0 && (int) $deadlineDeskMax > 0) {
                $parameters["text"] .= "Tempo para retirada no balcão é de: " . $deadlineDesk . " até ".$deadlineDeskMax." minutos.\n";
            }
            elseif ((int) $deadlineDesk > 0 && (int) $deadlineDeskMax <= 0) {
                $parameters["text"] .= "Tempo mínimo para retirada no balcão: " . $deadlineDesk . " minutos.\n";
            }
            elseif ((int) $deadlineDesk <= 0 && (int) $deadlineDeskMax > 0) {
                $parameters["text"] .= "Tempo máximo para retirada no balcão: " . $deadlineDeskMax . " minutos.\n";
            }
        }

        $buttons[]             = $this->_button_webview("Pedido Online");
        $buttons[]             = $this->_button_others();
        //insere os botões 
        $parameters["buttons"] = $buttons;

        return $this->_sendMessage($parameters);
    }

    private function _process_payment() {
        $card = \Model_Botcard::getByPayload("PAYLOAD_PAYMENT");

        $parameters         = array();
        $parameters["text"] = $card['message_fixed'] . "\n";
        if ($card['show_message_custom']) {
            $parameters["text"] .= $card['message_custom'] . "\n";
        }
        if ($card['show_message_processed']) {
            $methodsAndTypes = $this->_process_methods_and_types_of_payment();
            if (!empty($methodsAndTypes)) {
                foreach ($methodsAndTypes as $type => $methods) {
                    if ($type != "Guias" && $type != "Saldo") {
                        $parameters["text"] .= "*" . $type . "*: " . join(", ", $methods) . "\n";
                    }
                }
            }
        }

        $buttons[]             = $this->_button_webview("Pedido Online");
        $buttons[]             = $this->_button_others();
        //insere os botões 
        $parameters["buttons"] = $buttons;

        return $this->_sendMessage($parameters);
    }

    private function _process_methods_and_types_of_payment() {
        $return          = array();
        $methodsAndTypes = \Front\Model\Paymentmethod::getMethodsAndTypes();
        if ($methodsAndTypes) {
            foreach ($methodsAndTypes as $method_type) {
                $return[$method_type['type_name']][] = $method_type['method_name'];
            }
        }

        return $return;
    }

    private function _process_delivery() {
        $payload = $this->_get_delivery_payload();
        $card    = \Model_Botcard::getByPayload($payload);

        $parameters            = array();
        $buttons[]             = $this->_button_others();
        //insere os botões 
        $parameters["buttons"] = $buttons;
        $parameters["text"]    = $card['message_fixed'] . "\n";
        if ($card['show_message_custom']) {
            $parameters["text"] .= $card['message_custom'] . "\n";
        }
        if ($card['show_message_processed']) {
            switch ($payload) {
                case "PAYLOAD_DELIVERY_MANUAL":
                    return $this->_process_payload_delivery_manual($parameters);
                    break;

                case "PAYLOAD_DELIVERY_GEOLOCATION":
                    return $this->_process_payload_geolocation($parameters["text"]);
                    break;

                case "PAYLOAD_DELIVERY_POSTCODE":
                    return $this->_sendMessage($parameters);
                    break;
            }
        }
    }

    private function _get_delivery_payload() {
        if (Model_Config::get_value('delivery_price_regions') == "manual") {
            return "PAYLOAD_DELIVERY_MANUAL";
        }
        elseif (Model_Config::get_value('delivery_price_regions') == "zipcode" && Model_Config::get_value('delivery_price') == "maps") {
            return "PAYLOAD_DELIVERY_GEOLOCATION";
        }
        return "PAYLOAD_DELIVERY_POSTCODE";
    }

    private function _process_payload_delivery_manual($parameters) {
        //exibir lista de bairros
        $text = "";
        $fetchRegionsManual = Model_Region::fetchRegionsManual();
        if ($fetchRegionsManual) {
            foreach ($fetchRegionsManual as $region) {
                $text .= $region['district_name'] . " - R$ " . number_format($region['price'], 2, ',', '') . "\n";
            }
            if (strlen($parameters['text'].$text) >= 640) { //Texto da mensagem. As prévias não serão exibidas para as URLs nesse campo. Use anexos em vez disso. Deve estar codificado em UTF-8 e tem um limite de 640 caracteres. 
                //insere os botões o botão para acessar a webview com a lista de bairros
                $buttons[]             = $this->_button_webview("Ver Lista", "/front/sobre/entrega");
                $parameters["buttons"] = $buttons;
            }
            else {
                $parameters['text'] .= $text;
            }
        }
        else {
            $parameters['text'] .= "ATENÇÃO: não conseguimos identificar os bairros de entrega.";
        }
        return $this->_sendMessage($parameters);
    }

    private function _process_payload_geolocation($text) {
        //cabeçalho : comum em todas as mensagens
        $content                    = array();
        $content["messaging_type"]  = "RESPONSE";
        $content["recipient"]["id"] = $this->_sender;

        $content["message"]                  = array();
        $content["message"]["text"]          = $text;
        $quick_replies[]                     = $this->_quick_reply_location();
        $content["message"]["quick_replies"] = $quick_replies;
        \Controller_Penknife::callFacebook($content, Model_Config::get_value('bot_api_url_messages'));
    }

    /**
     * RESPONDE SE ESTÁ OU NÃO NA ÁREA DE ENTREGA, 
     * DEPOIS DO USUÁRIO COMPARTILHAR SUA GEOLOCALIZAÇÃO
     * 
     * TODO: VERIFICAR SE SERÁ NECESSÁRIO TER ESTAS MENSAGENS NO BANCO DE DADOS
     * @return type
     */
    private function _answer_delivery_geolocation() {
        $parameters["text"] = ">:( não conseguimos encontrar seu endereço corretamente! ";
        $buttons[]          = $this->_button_others();
        if ($this->_latlng) {
            $findDeliveryArea = Model_Deliveryareas::findDeliveryarea($this->_latlng);
            if ($findDeliveryArea) {
                if ($findDeliveryArea['compatible']) {
                    $parameters["text"] = "^_^ Oba! Você está em nossa área de entrega! Agora é só fazer seu pedido online!";
                    $buttons[]          = $this->_button_webview();
                }
                else {
                    $parameters["text"] = ":'( que pena! Não entregamos no seu endereço!";
                }
            }
        }
        $parameters["buttons"] = $buttons;
        return $this->_sendMessage($parameters);
    }

    private function _answer_delivery_postcode() {
        $parameters["text"] = ":'( que pena! Não entregamos no seu endereço!";
        $buttons[]          = $this->_button_others();

        if ($this->_postcode) {
            //buscar o endereço pelo zipcode
            $findZipcode = Model_Street::findZipcode($this->_postcode);
            if ($findZipcode) {
                $findRegion = Model_Region::findRegionByDistrictId($findZipcode['district_id']);
                if ($findRegion) {
                    $parameters["text"] = "^_^ Oba! Você está em nossa área de entrega! Agora é só fazer seu pedido online!";
                    $buttons[]          = $this->_button_webview();
                }
            }
        }
        $parameters["text"]    = $parameters["text"];
        $parameters["buttons"] = $buttons;
        return $this->_sendMessage($parameters);
    }

    /**
     * BOTÕES
     * *************************************************************************
     */

    /**
     * RESPONDE POR: PAYLOAD_ORDER
     * @return array
     */
    private function _button_webview($title = "Pedido Online", $url_complement = "/front") {
        $button["type"]                 = "web_url";
        $button["url"]                  = Model_Config::get_value('bot_base_url') . $url_complement;
        $button["title"]                = $title;
        $button["webview_height_ratio"] = "full"; //compact, tall, full
        $button["messenger_extensions"] = true; //utiliza extensões js do lado do webview -> messanger.Extensions.js
        return $button;
    }

    private function _button_others() {
        $card              = \Model_Botcard::getByPayload("PAYLOAD_OTHERS");
        $button["type"]    = "postback";
        $button["title"]   = $card['title'];
        $button["payload"] = "PAYLOAD_OTHERS";
        return $button;
    }

    private function _button_change_store() {
        $button["type"]    = "postback";
        $button["title"]   = "Trocar de Loja";
        $button["payload"] = "PAYLOAD_MULTIPLE_STORES";
        return $button;
    }

    /**
     * GERA O BOTÃO DE GEOLOCALIZAÇÃO
     * @return array
     */
    private function _quick_reply_location() {
        $button["content_type"] = "location";
        return $button;
    }

    /**
     * FACEBOOK
     * *************************************************************************
     */
    private function _sendMessage($parameters) {
        //cabeçalho : comum em todas as mensagens
        $content                    = array();
        $content["messaging_type"]  = "RESPONSE";
        $content["recipient"]["id"] = $this->_sender;

        $content["message"]                                   = array();
        //anexos (botões e afins) - comum em todas
        $attachment                                           = array();
        $attachment["attachment"]["type"]                     = "template";
        $attachment["attachment"]["payload"]["template_type"] = "button";
        $attachment["attachment"]["payload"]["text"]          = $parameters["text"];
        if (isset($parameters["buttons"])) {
            $attachment["attachment"]["payload"]["buttons"] = $parameters["buttons"];
        }
        $content["message"] = $attachment;

        $this->_logDebug($content, "BODY");

        $return = \Controller_Penknife::callFacebook($content, Model_Config::get_value('bot_api_url_messages'));
        $this->_logDebug($return, "SENDMESSAGE");
        return $return;
    }

    private function _callExternalBot($url, $data) {
        $update                                       = array();
        $update['entry'][0]['messaging'][0]           = $data;
        $update['entry'][0]['messaging'][0]["source"] = "multiloja";
        $data                                         = json_encode($update);
        $ch                                           = curl_init($url . "/admin2/api/bot");
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5); //timeout in seconds
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array(
            'Content-Type: application/json',
            'Content-Length: ' . strlen($data))
        );
        curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
        $errors                                       = curl_error($ch);
        $result                                       = curl_exec($ch);
        curl_close($ch);
        $this->_logDebug($errors, "ERROS CURL - TESTE 8");
        $this->_logDebug($result, "RESULTADO CURL - TESTE 9");
        return $result;
    }

    /**
     * Registra em log as transações para debugar
     * @param type $text
     * @param type $header
     */
    private function _logDebug($text, $header = "") {
        if ($this->_debug == true) {
            $text = is_array($text) ? json_encode($text) : $text;
            print "<br/>" . $header . " -> " . $text . "<br/><br/>";
            Log::error("\n" . $header . " -> " . $text . "\n\n");
        }
    }

}
