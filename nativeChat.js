/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 * @flow
 */

 import React, { Component } from "react";
 import {
  Platform,
  StyleSheet,
  Text,
  View,
  AsyncStorage,
  ScrollView,
  Alert,
  Modal,
  TouchableOpacity
} from "react-native";

import {observer} from 'mobx-react';
import Icone from "../../components/Icone";
import NavBar from "../../components/NavBar";
import Font from "../../functions/Font";
import { GiftedChat, Send, Bubble } from 'react-native-gifted-chat';
import { GlobalContext } from "../../context/GlobalContext";
import { GlobalStyles } from "../Global/Styles/Index.js";

import "moment";
import "moment/locale/pt";

import axios from 'axios';

class Chat extends Component {

  static navigationOptions = ({ navigation }) => {
    return {
      headerTitle: (
        <GlobalContext.Consumer>
        {context => (
          <Text style={GlobalStyles.title}>
          {context.language.chat.toUpperCase()}
          </Text>
          )}
        </GlobalContext.Consumer>
        )
    };
  };

  constructor(props) {
    super(props);

    this.state = {
      messages: [],
      loading: false
    }
  }

  componentWillMount() {
   this.setState({
     messages: [
     {
       _id: 1,
       text: 'Olá, seja bem vindo ao Chat da Carmen Steffens. Digite sua mensagem para prosseguir.',
       createdAt: new Date(),
       user: {
         _id: 2,
         name: 'CSBOT'
       },
     },
     ],
   })
 }

 onSend(messages = []) {


  this.setState(previousState => ({
     messages: GiftedChat.append(previousState.messages, messages),
     loading: true
  }), () => {



      axios.get('https://faleconosco.carmensteffens.com.br/oracle-middleware/servicos/app/index.php?action=chat&msg='+messages[0].text)
        .then((response) => {

          console.log(response);

          let message;

          if(response && response.data && response.data.resposta && response.data.resposta != '') {
            message = response.data.resposta;
          } else {
            message = 'Não encontramos nenhum resultado para esta pergunta.';
          }

          let id = Math.floor(Date.now() / 10);

          let newMessages = [
                    {
                      _id: id,
                       createdAt: new Date(),
                       text: message,
                       user: { _id: 2 },
                     }
          ];

          console.log(newMessages); 

          this.setState(previousState => ({
             messages: GiftedChat.append(previousState.messages, newMessages),
             loading: false
          }));

      })
        .catch(function (error) {
      });

  });

 

 }

 renderSend(props) {
         return (
             <Send
                 {...props}
             >
                 <View style={styles.sendWrapper}>
                   <Text style={styles.sendText}>ENVIAR</Text>
                 </View>
             </Send>
         );
 }

 renderBubble(props) { 
  return ( <Bubble {...props} 
       wrapperStyle={{
           left: {
             backgroundColor: '#F0F0F0',
           },
           right: {
             backgroundColor: 'black'
           }
         }} /> )
}

 render() {
  return (
          <GiftedChat
            messages={this.state.messages}
            onSend={messages => this.onSend(messages)}
            locale={'pt'}
            renderAvatar={null}
            renderSend={this.renderSend}
            renderBubble={this.renderBubble}
            placeholder={'Digite uma mensagem...'}
            textInputProps={{
              style: {
                fontFamily: Font,
                flex: 1,
                fontSize: 16,
                paddingBottom: 15,
                marginRight: 10,
                paddingLeft: 5
              },
              selectionColor: 'black'
            }}
            renderFooter={() => (this.state.loading ? <View style={styles.userTyping}><Text style={styles.userTypingText}>...</Text></View> : null)}
            user={{
              _id: 1,
            }}
          />
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  sendText: {
    fontFamily: Font,
    lineHeight: 14,
    fontWeight: '500',
    color: AppStyles.colors.primary
  },
  sendWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 10,
    height: '100%'
  },
  userTyping: {
    backgroundColor: '#F0F0F0',
    margin: 10,
    width: 60,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10
  },
  userTypingText: {
    fontFamily: Font,
    fontWeight: 'bold',

    fontSize: 30,
    lineHeight: 18,
  }
});

export default observer(Chat);
