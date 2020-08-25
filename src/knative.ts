/*
 * Copyright (c) 2020 the Octant contributors. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// core-js and regenerator-runtime are requried to ensure the correct polyfills
// are applied by babel/webpack.
import "core-js/stable";
import "regenerator-runtime/runtime";

import YAML from "yaml";

// plugin contains interfaces your plugin can expect
// this includes your main plugin class, response, requests, and clients.
import * as octant from "./octant/plugin";

// helpers for generating the
// objects that Octant can render to components.
import * as h from "./octant/component-helpers";

// components
import { ComponentFactory, FactoryMetadata } from "./octant/component-factory";
import { EditorFactory } from "./octant/editor";
import { TextFactory } from "./octant/text";
import { LinkFactory } from "./octant/link";
import { ListFactory } from "./octant/list";

import { Configuration, ConfigurationListFactory, ConfigurationSummaryFactory } from "./serving/configuration";
import { Revision } from "./serving/revision";
import { Route, RouteListFactory, RouteSummaryFactory } from "./serving/route";
import { Service, ServiceListFactory, ServiceSummaryFactory } from "./serving/service";
import { ButtonGroupFactory } from "./octant/button-group";

export default class MyPlugin implements octant.Plugin {
  // Static fields that Octant uses
  name = "knative";
  description = "Knative plugin for Octant";

  // If true, the contentHandler and navigationHandler will be called.
  isModule = true;;

  // Octant will assign these via the constructor at runtime.
  dashboardClient: octant.DashboardClient;
  httpClient: octant.HTTPClient;

  // Plugin capabilities
  capabilities = {
    supportPrinterConfig: [],
    supportTab: [],
    actionNames: ["knative/testAction", "action.octant.dev/setNamespace"],
  };

  // Custom plugin properties
  namespace: string;

  // Octant expects plugin constructors to accept two arguments, the dashboardClient and the httpClient
  constructor(
    dashboardClient: octant.DashboardClient,
    httpClient: octant.HTTPClient
  ) {
    this.dashboardClient = dashboardClient;
    this.httpClient = httpClient;

    this.namespace = "default";
  }

  printHandler(request: octant.ObjectRequest): octant.PrintResponse {
    throw new Error('KnativePlugin#printHandler should never be called');
  }

  actionHandler(request: octant.ActionRequest): octant.ActionResponse | void {
    if (request.actionName === "action.octant.dev/setNamespace") {
      this.namespace = request.payload.namespace;
      return;
    }

    return;
  }

  tabHandler(request: octant.ObjectRequest): octant.TabResponse {
    throw new Error('KnativePlugin#tabHandler should never be called');
  }

  navigationHandler(): octant.Navigation {
    let nav = new h.Navigation("Knative", "knative", "cloud");
    nav.add("Services", "services");
    nav.add("Configurations", "configurations");
    nav.add("Routes", "routes");
    return nav;
  }

  contentHandler(request: octant.ContentRequest): octant.ContentResponse {
    const { contentPath } = request;

    // TODO use a proper path router
    if (contentPath === "") {
      return this.knativeOverviewHandler(request);
    } else if (contentPath === "/services") {
      return this.serviceListingHandler(request);
    } else if (contentPath.startsWith("/services/")) {
      return this.serviceDetailHandler(request);
    } else if (contentPath === "/configurations") {
      return this.configurationListingHandler(request);
    } else if (contentPath.startsWith("/configurations/")) {
      return this.configurationDetailHandler(request);
    } else if (contentPath === "/routes") {
      return this.routeListingHandler(request);
    } else if (contentPath.startsWith("/routes/")) {
      return this.routeDetailHandler(request);
    }

    // not found
    let notFound = new TextFactory({ value: `Not Found - ${contentPath}` });
    return h.createContentResponse([notFound], [notFound])
  }

  knativeOverviewHandler(request: octant.ContentRequest): octant.ContentResponse {
    const title = [new TextFactory({ value: "Knative" })];
    const body = new ListFactory({
      factoryMetadata: {
        title: title.map(f => f.toComponent()),
      },
      items: [
        this.serviceListing({
          title: [new TextFactory({ value: "Services" }).toComponent()],
        }).toComponent(),
        this.configurationListing({
          title: [new TextFactory({ value: "Configurations" }).toComponent()],
        }).toComponent(),
        this.routeListing({
          title: [new TextFactory({ value: "Routes" }).toComponent()],
        }).toComponent(),
      ],
    })
    return h.createContentResponse(title, [body]);
  }

  serviceListingHandler(request: octant.ContentRequest): octant.ContentResponse {
    const title = [
      new LinkFactory({ value: "Knative", ref: "/knative" }),
      new TextFactory({ value: "Services" }),
    ];
    const body = new ListFactory({
      items: [
        this.serviceListing({
          title: [new TextFactory({ value: "Services" }).toComponent()],
        }).toComponent(),
      ],
      factoryMetadata: {
        title: title.map(f => f.toComponent()),
      },
    })
    return h.createContentResponse(title, [body]);
  }

  serviceDetailHandler(request: octant.ContentRequest): octant.ContentResponse {
    const name = request.contentPath.split("/")[2];
    const title = [
      new LinkFactory({ value: "Knative", ref: "/knative" }),
      new LinkFactory({ value: "Services", ref: "/knative/services" }),
      new TextFactory({ value: name }),
    ];
    const body = this.serviceDetail(name);
    const buttonGroup = new ButtonGroupFactory({
      buttons: [
        {
          name: "Delete",
          payload: {
            action: "action.octant.dev/deleteObject",
            apiVersion: "serving.knative.dev/v1",
            kind:       "Service",
            namespace:  this.namespace,
            name:       name,
          },
          confirmation: {
            title: "Delete Service",
            body: `Are you sure you want to delete *Service* **${name}**? This action is permanent and cannot be recovered.`,
          },
        },
      ],
    });
    return h.createContentResponse(title, body, buttonGroup);
  }

  configurationListingHandler(request: octant.ContentRequest): octant.ContentResponse {
    const title = [
      new LinkFactory({ value: "Knative", ref: "/knative" }),
      new TextFactory({ value: "Configurations" }),
    ];
    const body = new ListFactory({
      items: [
        this.configurationListing({
          title: [new TextFactory({ value: "Configurations" }).toComponent()],
        }).toComponent(),
      ],
      factoryMetadata: {
        title: title.map(f => f.toComponent()),
      },
    })
    return h.createContentResponse(title, [body]);
  }

  configurationDetailHandler(request: octant.ContentRequest): octant.ContentResponse {
    const name = request.contentPath.split("/")[2];
    const title = [
      new LinkFactory({ value: "Knative", ref: "/knative" }),
      new LinkFactory({ value: "Configurations", ref: "/knative/configurations" }),
      new TextFactory({ value: name }),
    ];
    const body = this.configurationDetail(name);
    const buttonGroup = new ButtonGroupFactory({
      buttons: [
        {
          name: "Delete",
          payload: {
            action: "action.octant.dev/deleteObject",
            apiVersion: "serving.knative.dev/v1",
            kind:       "Configuration",
            namespace:  this.namespace,
            name:       name,
          },
          confirmation: {
            title: "Delete Configuration",
            body: `Are you sure you want to delete *Configuration* **${name}**? This action is permanent and cannot be recovered.`,
          },
        },
      ],
    });
    return h.createContentResponse(title, body, buttonGroup);
  }

  routeListingHandler(request: octant.ContentRequest): octant.ContentResponse {
    const title = [
      new LinkFactory({ value: "Knative", ref: "/knative" }),
      new TextFactory({ value: "Routes" }),
    ];
    const body = new ListFactory({
      items: [
        this.routeListing({
          title: [new TextFactory({ value: "Routes" }).toComponent()],
        }).toComponent(),
      ],
      factoryMetadata: {
        title: title.map(f => f.toComponent()),
      },
    })
    return h.createContentResponse(title, [body]);
  }

  routeDetailHandler(request: octant.ContentRequest): octant.ContentResponse {
    const name = request.contentPath.split("/")[2];
    const title = [
      new LinkFactory({ value: "Knative", ref: "/knative" }),
      new LinkFactory({ value: "Routes", ref: "/knative/routes" }),
      new TextFactory({ value: name }),
    ];
    const body = this.routeDetail(name);
    const buttonGroup = new ButtonGroupFactory({
      buttons: [
        {
          name: "Delete",
          payload: {
            action: "action.octant.dev/deleteObject",
            apiVersion: "serving.knative.dev/v1",
            kind:       "Route",
            namespace:  this.namespace,
            name:       name,
          },
          confirmation: {
            title: "Delete Route",
            body: `Are you sure you want to delete *Route* **${name}**? This action is permanent and cannot be recovered.`,
          },
        },
      ],
    });
    return h.createContentResponse(title, body, buttonGroup);
  }

  serviceListing(factoryMetadata?: FactoryMetadata): ComponentFactory<any> {
    const services: Service[] = this.dashboardClient.List({
      apiVersion: 'serving.knative.dev/v1',
      kind: 'Service',
      namespace: this.namespace,
    });
    services.sort((a, b) => (a.metadata.name || '').localeCompare(b.metadata.name || ''));

    return new ServiceListFactory({ services, factoryMetadata });
  }

  serviceDetail(name: string): ComponentFactory<any>[] {
    const service: Service = this.dashboardClient.Get({
      apiVersion: 'serving.knative.dev/v1',
      kind: 'Service',
      namespace: this.namespace,
      name: name,
    });
    const revisions: Revision[] = this.dashboardClient.List({
      apiVersion: 'serving.knative.dev/v1',
      kind: 'Revision',
      namespace: this.namespace,
      selector: {
        'serving.knative.dev/service': service.metadata.name,
      },
    });
    revisions.sort((a, b) => {
      const generationA = (a.metadata.labels || {})['serving.knative.dev/configurationGeneration'] || '-1';
      const generationB = (b.metadata.labels || {})['serving.knative.dev/configurationGeneration'] || '-1';
      return parseInt(generationA) - parseInt(generationB)
    });

    return [
      new ServiceSummaryFactory({
        service,
        revisions,
        factoryMetadata: {
          title: [new TextFactory({ value: "Summary" }).toComponent()],
          accessor: "summary",
        },
      }),
      new EditorFactory({
        value: "---\n" + YAML.stringify(JSON.parse(JSON.stringify(service)), { sortMapEntries: true }),
        readOnly: false,
        metadata: {
          apiVersion: service.apiVersion,
          kind: service.kind,
          namespace: service.metadata.namespace || '',
          name: service.metadata.name || '',
        },
        factoryMetadata: {
          title: [new TextFactory({ value: "YAML" }).toComponent()],
          accessor: "yaml",
        },
      })
    ];
  }

  configurationListing(factoryMetadata?: FactoryMetadata): ComponentFactory<any> {
    const configurations: Configuration[] = this.dashboardClient.List({
      apiVersion: 'serving.knative.dev/v1',
      kind: 'Configuration',
      namespace: this.namespace,
    });
    configurations.sort((a, b) => (a.metadata.name || '').localeCompare(b.metadata.name || ''));

    return new ConfigurationListFactory({ configurations, factoryMetadata });
  }

  configurationDetail(name: string): ComponentFactory<any>[] {
    const configuration: Configuration = this.dashboardClient.Get({
      apiVersion: 'serving.knative.dev/v1',
      kind: 'Configuration',
      namespace: this.namespace,
      name: name,
    });
    const revisions: Revision[] = this.dashboardClient.List({
      apiVersion: 'serving.knative.dev/v1',
      kind: 'Revision',
      namespace: this.namespace,
      selector: {
        'serving.knative.dev/configuration': configuration.metadata.name,
      },
    });
    revisions.sort((a, b) => {
      const generationA = (a.metadata.labels || {})['serving.knative.dev/configurationGeneration'] || '-1';
      const generationB = (b.metadata.labels || {})['serving.knative.dev/configurationGeneration'] || '-1';
      return parseInt(generationA) - parseInt(generationB)
    });

    return [
      new ConfigurationSummaryFactory({
        configuration,
        revisions,
        factoryMetadata: {
          title: [new TextFactory({ value: "Summary" }).toComponent()],
          accessor: "summary",
        },
      }),
      new EditorFactory({
        value: "---\n" + YAML.stringify(JSON.parse(JSON.stringify(configuration)), { sortMapEntries: true }),
        readOnly: false,
        metadata: {
          apiVersion: configuration.apiVersion,
          kind: configuration.kind,
          namespace: configuration.metadata.namespace || '',
          name: configuration.metadata.name || '',
        },
        factoryMetadata: {
          title: [new TextFactory({ value: "YAML" }).toComponent()],
          accessor: "yaml",
        },
      })
    ];
  }

  routeListing(factoryMetadata?: FactoryMetadata): ComponentFactory<any> {
    const routes: Route[] = this.dashboardClient.List({
      apiVersion: 'serving.knative.dev/v1',
      kind: 'Route',
      namespace: this.namespace,
    });
    routes.sort((a, b) => (a.metadata.name || '').localeCompare(b.metadata.name || ''));

    return new RouteListFactory({ routes, factoryMetadata });
  }

  routeDetail(name: string): ComponentFactory<any>[] {
    const route: Route = this.dashboardClient.Get({
      apiVersion: 'serving.knative.dev/v1',
      kind: 'Route',
      namespace: this.namespace,
      name: name,
    });

    return [
      new RouteSummaryFactory({
        route,
        factoryMetadata: {
          title: [new TextFactory({ value: "Summary" }).toComponent()],
          accessor: "summary",
        },
      }),
      new EditorFactory({
        value: "---\n" + YAML.stringify(JSON.parse(JSON.stringify(route)), { sortMapEntries: true }),
        readOnly: false,
        metadata: {
          apiVersion: route.apiVersion,
          kind: route.kind,
          namespace: route.metadata.namespace || '',
          name: route.metadata.name || '',
        },
        factoryMetadata: {
          title: [new TextFactory({ value: "YAML" }).toComponent()],
          accessor: "yaml",
        },
      })
    ];
  }

}

console.log("loading knative.ts");
