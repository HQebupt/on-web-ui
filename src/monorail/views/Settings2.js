// Copyright 2018, EMC, Inc.

import React, { Component, PropTypes } from 'react';
import radium from 'radium';
import { browserHistory } from 'react-router';
import { RouteHandler, Link } from 'react-router';
import {
    AutoComplete,
    FontIcon,
    IconButton,
    Popover,
    Toolbar,
    ToolbarGroup,
    ToolbarTitle,
    ToolbarSeparator,
    LinearProgress,

    SelectField,
    MenuItem,
    RaisedButton,
    TextField,
    Toggle
  } from 'material-ui';

import Swagger from 'swagger-client';

import config from 'src-config/index';
import UserLogin from 'src-common/views/UserLogin';
import LoginRestAPI from 'src-common/messengers/LoginRestAPI';
import RackHDRestAPIv2_0 from 'src-common/messengers/RackHDRestAPIv2_0';
import NodeStore from 'src-common/stores/NodeStore';
import CatalogStore from 'src-common/stores/CatalogStore';

import EndpointInput from './EndpointInput';
import Workflow4Poc from 'src-workflow-editor/views/Workflow4Poc';
import JsonEditor from 'src-common/views/JsonEditor';

@radium
export default class Settings2 extends Component {

  static defaultProps = {
    css: {}
  };

  static contextTypes = {
    router: PropTypes.any
  };

  nodes = new NodeStore();
  catalogs = new CatalogStore();

  get workflowOperator() {
    return this.context.workflowOperator;
  }

  componentWillMount() {
    this.nodes.startMessenger();
    this.catalogs.startMessenger();
  }

  componentDidMount() {
    this.unwatchNodes = this.nodes.watchAll('nodes', this);
    this.unwatchCatalogs = this.catalogs.watchAll('catalogs', this);
    this.setState({options: ["6.5","6"]});
    this.listNodes();
  }

  componentWillUnmount() {
    this.nodes.stopMessenger();
    this.catalogs.stopMessenger();
    this.unwatchNodes();
  }

  listNodes() {
    let nodesOptions = [];
    let disksOptions = {};
    let networkDeviceOptions= {};
    let nodeIdOptions= {};
    this.setState({loading: true});
    this.nodes.list().then(() => {
      let promises = [];
      this.nodes.each(node => {
        console.log("[DEBUG] node info:", node);
        console.log("[DEBUG] node type:", node.type);
        console.log("[DEBUG] node id:", node.id);
        if (node.type == 'compute'){
            nodesOptions.push(node.id);
            let promise = new Promise((resolve) => {
                this.catalogs.relateNode(node, 'dmi', this.nodes).then(resolve, resolve);
                this.catalogs.relateNode(node, 'dmi', this.nodes).then(() => {
					let systemInfo = (node, prop) => {
					  console.log("[DEBUG] the current node is :", node);
					  let curr = node;
					  ['dmi', 'data', 'System Information'].forEach(key => {
						curr = curr && curr[key];
					  });
					  return curr && curr[prop] || 'N/A';
					};

                    let manufactuer = systemInfo(node, 'Manufacturer');
                    let model = systemInfo(node, 'Product Name');
                    let nodeKey = 'id:' + node.id + ', name:' + node.name + ', manufactuer:' + manufactuer + ', model:' + model;
                    nodeIdOptions[nodeKey] = node.id;
                    console.log("[DEBUG] nodeIdOptions for show:", nodeIdOptions);
                });

                this.catalogs.relateNode(node, 'driveId', this.nodes).then(() => {
                    disksOptions[node.id] = [];
                    // need for TODO
                    let devName = node.driveId.data[0].devName;
                    disksOptions[node.id].push(devName);
                    console.log("[DEBUG] can exexxxxxxx:", disksOptions);
                });

                console.log("[DEBUG]========================interface===========");
                this.catalogs.relateNode(node, 'ohai', this.nodes).then(() => {
                    let interfaceOptions = {};
                    let interfaceObj = node.ohai.data.network.interfaces;
                    let keys = Object.keys(interfaceObj);
                    console.log("[DEBUG] interfaceObj:", interfaceObj, ",keys:" , keys);
                    let usableInterface = [];
                    keys.forEach(function(element) {
                        if (element.startsWith("eth")){
                            usableInterface.push(element);
                            console.log("[DEBUG] ====== element:", element);
                            let interfaceKey = element + ", mac:" +
                                Object.keys(interfaceObj[element]['addresses'])[0];
                            interfaceOptions[interfaceKey] = 'vmnic' + element.substring(3);
                        }
                    });
                    console.log("[DEBUG] interfaceObj:", interfaceObj, ",keys:" , keys,
                        ",usableInterface:", usableInterface, ",interfaceOptions:", interfaceOptions);
                    networkDeviceOptions[node.id] = [];
                    networkDeviceOptions[node.id].push(interfaceOptions);
                    console.log("[DEBUG] networkDeviceOptions for all nodes:", networkDeviceOptions);
                });
            });
            promises.push(promise);
        }
      });

      Promise.all(promises).then(() => {
        console.log("[DEBUG] local nodesOptions:", nodesOptions);
        console.log("[DEBUG] local disksOptions:", disksOptions);
        console.log("[DEBUG] local nodeIdOptions:", nodeIdOptions);
        this.setState({nodesOptions: nodesOptions});
        this.setState({disksOptions: disksOptions});
        this.setState({networkDeviceOptions: networkDeviceOptions});
        this.setState({nodeIdOptions: nodeIdOptions});
        this.setState({loading: false});
      });
    });
  }


  css = {
    root: {}
 };

  state = {
    authError: null,
    enableSSL: this.enableSSL,
    enableAuth: this.enableAuth,

    version: this.version,
    nodeId: null,
    installDisk: 'sda',
    networkDevice: 'vmnic0',
    workflowName: 'Graph.InstallESXi',
    rackhdIp: this.getConfigValue('RackHD_API'),
    rootPassword: this.rootPassword,
    dnsServers: this.dnsServers,
    ipAddress: this.ipAddress,
    gateway: this.gateway,
    netmask: this.netmask,
    repoUrl: null,
    options: [],
    nodesOptions: [],
    disksOptions: {},
    networkDeviceOptions: {},
    visibility: 'hidden', //visible,hidden
    esxiVisibility: 'visible', //visible,hidden

    rackhdWSS: this.rackhdWSS,
    rackhdAPI: this.rackhdAPI,
    rackhdAuthToken: this.rackhdAuthToken,
    redfishAPI: this.redfishAPI
  };


  handleVersionChange = (event, index, version) => this.setState({version});

  render() {
    let { props } = this;
    console.log("[DEBUG] esxi version:", this.version);

    let css = {
      root: [
        this.css.root,
        props.css.root,
        props.style
      ]
    };

    let divStyle = {
      width: 'auto',
      float: 'auto',
      clear: 'both',
      overflow: 'visible',
      position: 'relative',
      visibility: this.state.esxiVisibility,
    };


    return (
      <div style={css.root}>



        <div className="EditorToolbar" style={divStyle}>
            {this.renderToolbar()}
            {this.renderNodesToolbar()}
            {this.renderDriveIdToolbar()}
            {this.renderNetworkToolbar()}
        </div>

        <div style={{padding: 10}}>
          <p>
           Please fill the following payload.
          </p>

          <fieldset style={{marginTop: 5}}>
            <legend style={{padding: 5}}>Payload</legend>

            <TextField
                ref="rootPassword"
                fullWidth={false}
                hintText={this.rootPassword}
                value={this.state.rootPassword}
                floatingLabelText="Root Password"
                onChange={(e) => this.setState({rootPassword: e.target.value})} />
            <TextField
                ref="dnsServers"
                fullWidth={false}
                hintText={this.dnsServers}
                value={this.state.dnsServers}
                floatingLabelText="DNS Servers"
                onChange={(e) => this.setState({dnsServers: e.target.value})} />
            <TextField
                ref="ipAddress"
                fullWidth={false}
                hintText={this.ipAddress}
                value={this.state.ipAddress}
                floatingLabelText="IP Address"
                onChange={(e) => this.setState({ipAddress: e.target.value})} />
            <TextField
                ref="gateway"
                fullWidth={false}
                hintText={this.gateway}
                value={this.state.gateway}
                floatingLabelText="Gateway"
                onChange={(e) => this.setState({gateway: e.target.value})} />
            <TextField
                ref="netmask"
                fullWidth={false}
                hintText={this.netmask}
                value={this.state.netmask}
                floatingLabelText="NETMASK"
                onChange={(e) => this.setState({netmask: e.target.value})} />
            <TextField
                ref="repoUrl"
                fullWidth={false}
                hintText={this.repoUrl}
                value={this.state.repoUrl}
                floatingLabelText="REPO URL(Options)"
                onChange={(e) => this.setState({repoUrl: e.target.value})} />


          </fieldset>
          <div>
                {this.renderAdvancedInstall()}
          </div>


          <div style={{textAlign: 'left', marginTop: 20}}>
            <RaisedButton secondary={true} label="Start OS Install" onClick={this.updateSettings.bind(this)}/>
          </div>
        </div>

      </div>
    );
  }

  renderToolbar() {
    return (
      <Toolbar>
        <ToolbarGroup firstChild={true} firstChild={true}>
          <ToolbarTitle text="&nbsp;" />
          <ToolbarTitle text="ESXi version:" />
          {this.renderWorkflowSelect()}
       </ToolbarGroup>
      </Toolbar>
    );
  }

  renderNodesToolbar() {
    return (
      <Toolbar>
        <ToolbarGroup firstChild={true} firstChild={true}>
          <ToolbarTitle text="&nbsp;" />
          <ToolbarTitle text="Node ID:" />
          {this.renderNodesSelect()}
       </ToolbarGroup>
      </Toolbar>
    );
  }

  renderDriveIdToolbar() {
    return (
      <Toolbar>
        <ToolbarGroup firstChild={true} firstChild={true}>
          <ToolbarTitle text="&nbsp;" />
          <ToolbarTitle text="Install Disk:" />
          {this.renderDisksSelect()}
       </ToolbarGroup>
      </Toolbar>
    );
  }


  renderNetworkToolbar() {
    return (
      <Toolbar>
        <ToolbarGroup firstChild={true} firstChild={true}>
          <ToolbarTitle text="&nbsp;" />
          <ToolbarTitle text="Network interface:" />
          {this.renderNetworkSelect()}
       </ToolbarGroup>
      </Toolbar>
    );
  }

  renderAdvancedInstall() {
    return (
//      <Toolbar>
//        <ToolbarGroup firstChild={true} lastChild={true} >
//            <div className="Workflow4Poc">
//                <Workflow4Poc />
//            </div>
//       </ToolbarGroup>
//      </Toolbar>
     <div >
       <Toolbar>
         <ToolbarGroup key={1} lastChild={true}>
           <RaisedButton
               label="Cancel"
               onClick={this.props.onDone || browserHistory.goBack.bind(this)}
               disabled={this.state.disabled} />
           <RaisedButton
               label="Run"
               primary={true}
               onClick={this.saveWorkflow.bind(this)}
               disabled={this.state.disabled} />
         </ToolbarGroup>
       </Toolbar>
       <LinearProgress mode={this.state.loading ? 'indeterminate' : 'determinate'} value={100} />
       <div style={{padding: '0 10px 10px'}}>
         <h5 style={{margin: '15px 0 5px', color: '#666'}}>Workflow JSON:</h5>
         <JsonEditor
             value={{"options": this.state.workflow && this.state.workflow.options || {}}}
             updateParentState={this.updateStateFromJsonEditor.bind(this)}
             disabled={this.state.disabled}
             ref="jsonEditor" />
       </div>
     </div>

    );
  }

    saveWorkflow() {
    }

    updateStateFromJsonEditor() {
    }

  renderWorkflowSelect(state = this.state) {
    console.log("[DEBUG] esxi version options:", state.options);
    return (
      <AutoComplete key="workflows"
          style={{width: 276, top: 8, float: 'left'}}
          filter={() => true}
          openOnFocus={true}
          menuStyle={{maxHeight: 250, width: 276, overflow: 'auto'}}
          animated={true}
          hintText="Select"
          dataSource={state.options}
          onUpdateInput={(value) => {
            this.setState({version: value});
          }}
      />
    );
  }

  renderNodesSelect(state = this.state) {
    let nodesOptions = ['should select'];
    let nodeIdOptions = {};
    if (state.nodeIdOptions) {
        nodeIdOptions = state.nodeIdOptions;
        nodesOptions = Object.keys(nodeIdOptions);
        console.log("[DEBUG] node id options:", nodeIdOptions, ", nodeOptions:", nodesOptions);
    }
    console.log("[DEBUG] after node id options:", nodeIdOptions, ", nodeOptions:", nodesOptions);

    return (
      <AutoComplete key="workflows"
          style={{width: 876, top: 8, float: 'left'}}
          fullWidth={true}
          filter={() => true}
          openOnFocus={true}
          menuStyle={{maxHeight: 250, width: 'auto', overflow: 'auto'}}
          animated={true}
          hintText="Select"
          searchText={state.workflowTerm || state.workflow && state.workflow.friendlyName}
          dataSource={nodesOptions}
          onUpdateInput={(value) => {
            this.setState({nodeId: nodeIdOptions[value]});
            this.setState({visibility: 'visible'});
          }}
      />
    );
  }


  renderDisksSelect(state = this.state) {
    let localDisksOptions = ["should select nodeId"];
    console.log("[DEBUG] nodeId:", state.nodeId, "disks options:", localDisksOptions);
    if (state.nodeId) {
        localDisksOptions = state.disksOptions[state.nodeId];
        console.log("[DEBUG] nodeId show:", state.nodeId, "disks options:", localDisksOptions)
    }

    return (
      <AutoComplete key="workflows"
          style={{width: 276, top: 8, float: 'left', visibility: state.visibility}}
          filter={() => true}
          openOnFocus={true}
          menuStyle={{maxHeight: 250, width: 276, overflow: 'auto'}}
          animated={true}
          hintText="Select"
          searchText={state.workflowTerm || state.workflow && state.workflow.friendlyName}
          dataSource={localDisksOptions}
          onUpdateInput={(value) => {
            this.setState({installDisk: value});
          }}
      />
    );
  }




  renderNetworkSelect(state = this.state) {
    let localNetworkOptions = {};
    let ethAll = ["should select nodeId"];
    console.log("[DEBUG] nodeId:", state.nodeId, "networkDevice options:", localNetworkOptions);
    if (state.nodeId) {
        localNetworkOptions = state.networkDeviceOptions[state.nodeId][0];
        console.log("[DEBUG] nodeId:", state.nodeId, "networkDevice options:", localNetworkOptions);
        ethAll = Object.keys(localNetworkOptions);
    }

    return (
      <AutoComplete key="workflows"
          style={{width: 276, top: 8, float: 'left', visibility: state.visibility}}
          filter={() => true}
          openOnFocus={true}
          menuStyle={{maxHeight: 250, width: 276, overflow: 'auto'}}
          animated={true}
          hintText="Select"
          searchText={state.workflowTerm || state.workflow && state.workflow.friendlyName}
          dataSource={ethAll}
          onUpdateInput={(value) => {
            this.setState({networkDevice: localNetworkOptions[value]});
            console.log("[DEBUG] xxxx localNetworkOptions:", localNetworkOptions, "value:", value);
            console.log("[DEBUG] xxxx networkDevice:", localNetworkOptions[value]);
          }}
      />
    );
  }



getConfigBoolean(key) {
    let localValue = window.localStorage.getItem(key);
    if (typeof localValue === 'string') { localValue = localValue === 'true'; }
    if (typeof localValue === 'boolean') { return localValue; }
    return config[key];
  }

  getConfigValue(key) { return window.localStorage.getItem(key) || config[key]; }

  setConfigValue(key, value) {
    window.localStorage.setItem(key, (config[key] = value));
    return value;
  }


  get version() { return this.getConfigValue('Default_Version'); }
  set version(value) { return this.setConfigValue('Default_Version', value); }

  get rootPassword() { return this.getConfigValue('Default_Root_Password'); }
  set rootPassword(value) { return this.setConfigValue('Default_Root_Password', value); }

  get dnsServers() { return this.getConfigValue('Default_DNS_Servers'); }
  set dnsServers(value) { return this.setConfigValue('Default_DNS_Servers', value); }

  get ipAddress() { return this.getConfigValue('Default_IP_Address'); }
  set ipAddress(value) { return this.setConfigValue('Default_IP_Address', value); }

  get gateway() { return this.getConfigValue('Default_Gateway'); }
  set gateway(value) { return this.setConfigValue('Default_Gateway', value); }

  get netmask() { return this.getConfigValue('Default_Netmask'); }
  set netmask(value) { return this.setConfigValue('Default_Netmask', value); }

  get enableAuth() { return this.getConfigBoolean('Enable_RackHD_API_Auth'); }
  set enableAuth(value) { return this.setConfigValue('Enable_RackHD_API_Auth', !!value); }

  get enableSSL() { return this.getConfigBoolean('Enable_RackHD_SSL'); }
  set enableSSL(value) { return this.setConfigValue('Enable_RackHD_SSL', !!value); }

  get rackhdWSS() { return this.getConfigValue('RackHD_WSS'); }
  set rackhdWSS(value) { return this.setConfigValue('RackHD_WSS', value); }

  get rackhdAPI() { return this.getConfigValue('RackHD_API'); }
  set rackhdAPI(value) { return this.setConfigValue('RackHD_API', value); }

  get rackhdAuthToken() { return this.getConfigValue('RackHD_API_Auth_Token'); }
  set rackhdAuthToken(value) { return this.setConfigValue('RackHD_API_Auth_Token', value); }

  get redfishAPI() { return this.getConfigValue('RedFish_API'); }
  set redfishAPI(value) { return this.setConfigValue('RedFish_API', value); }

  updateSettings() {

    this.version = this.state.version;
    this.rootPassword = this.state.rootPassword;
    this.dnsServers = this.state.dnsServers;//TODO: should be array
    this.ipAddress = this.state.ipAddress;
    this.gateway = this.state.gateway;
    this.netmask = this.state.netmask;
    this.repoUrl = this.state.repoUrl;

    this.enableAuth = this.state.enableAuth;
    this.enableSSL = this.state.enableSSL;
    this.rackhdWSS = this.state.rackhdWSS;
    this.rackhdAPI = this.state.rackhdAPI;
    this.rackhdAuthToken = this.state.rackhdAuthToken;
    this.consoleLog();
    this.postInstallOsWorkflow();
  }

  showAdvacedOsWorkflow() {
    let visibility = this.state.advancedVisibility;
    this.setState({advancedVisibility: visibility === 'visible' ? 'hidden': 'visible'});
    this.setState({esxiVisibility: visibility === 'hidden' ? 'hidden': 'visible'});
  }

    postInstallOsWorkflow() {
        let payload = {
            "options": {
                "defaults": {
                    "version": "{version}",
                    "repo": "http://{rackhd_ip}/esxi/{version}",
                    "rootPassword": "{rootPassword}",
                    "dnsServers": ["{dnsServers}"],
                    "networkDevices": [
                        {
                            "device": "{device}",
                            "ipv4": {
                                "ipAddr": "{ipAddr}",
                                "gateway": "{gateway}",
                                "netmask": "{netmask}"
                            }
                        }
                    ],
                    "installDisk": "{installDisk}",
                    "postInstallCommands": [
                        "echo This command will run at the end ",
                        "echo of the post installation step"
                    ]
                }
            }
        };
        payload.options.defaults.version = this.state.version;
        let rackhdShortIp = this.state.rackhdAPI.split('/')[0];
        console.log("[DEBUG]short rackhd IP:", rackhdShortIp);
        console.log("[DEBUG]repoUrl:", this.state.repoUrl);
        if (!this.state.repoUrl) {
            payload.options.defaults.repo = 'http://' + rackhdShortIp + '/esxi/' + this.state.version;
        } else {
            payload.options.defaults.repo = this.state.repoUrl;
        }
        console.log("[DEBUG]payload repoUrl:", payload.options.defaults.repo );

        payload.options.defaults.rootPassword = this.state.rootPassword;
        payload.options.defaults.dnsServers[0] = this.state.dnsServers;
        payload.options.defaults.networkDevices[0].device = this.state.networkDevice;
        payload.options.defaults.networkDevices[0].ipv4.ipAddr = this.state.ipAddress;
        payload.options.defaults.networkDevices[0].ipv4.gateway = this.state.gateway;
        payload.options.defaults.networkDevices[0].ipv4.netmask = this.state.netmask;
        payload.options.defaults.installDisk = this.state.installDisk;
        console.log("[DEBUG] os install payload:", payload);
        console.log("[DEBUG] nodeId:", this.state.nodeId);
        console.log("[DEBUG] nodeId:", this.state.installDisk);
        console.log("[DEBUG] nodeId:", this.state.networkDevice);
         RackHDRestAPIv2_0.api.nodesPostWorkflowById({
             body: payload,
             identifier: this.state.nodeId,
             name: this.state.workflowName
         }).then(res => {
           let workflow = res.obj;
           console.log("[DEBUG]##### response:", workflow);
         }).catch((err) => {
           console.error("[ERROR]:####", err);
         });
    }




  get rackhdProtocol() {
    return 'http' + (this.state.enableSSL ? 's' : '') + '://';
  }

  rackhdAPICheck = ({ resolve, reject }) => {
    console.log("############# rackhdAPICheck");
    let swaggerOptions = {
      usePromise: true,
      authorizations : {},
      url: this.rackhdProtocol + this.state.rackhdAPI + '/swagger'
    };
    if (this.state.enableAuth === true || this.state.enableAuth === 'true') {
      swaggerOptions.authorizations['Authentication-Token'] =
        new Swagger.ApiKeyAuthorization(
          'Authorization', 'JWT ' + this.state.rackhdAuthToken, 'header');
    }
    new Swagger(swaggerOptions).
      then(() => resolve('Connected to RackHD 2.0 endpoint!')).
      catch(() => reject('Failed to reach RackHD 2.0endpoint.'));
  };

}
