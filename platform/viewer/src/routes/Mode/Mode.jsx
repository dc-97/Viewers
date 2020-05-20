import React, { useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
//
import { ToolBarManager } from '@ohif/core';
import { DragAndDropProvider } from '@ohif/ui';
//
import { useQuery } from '@hooks';
import ViewportGrid from '@components/ViewportGrid';
import Compose from './Compose';
//import DisplaySetCreator from './DisplaySetCreator';

export default function ModeRoute({
  location,
  mode,
  dataSourceName,
  extensionManager,
  servicesManager,
}) {
  // Parse route params/querystring
  const query = useQuery();
  const queryStudyInstanceUIDs = query.get('StudyInstanceUIDs');
  const { StudyInstanceUIDs: paramsStudyInstanceUIDs } = useParams();
  const StudyInstanceUIDs = queryStudyInstanceUIDs || paramsStudyInstanceUIDs;

  const { extensions, sopClassHandlers } = mode;
  // TODO:
  // - Check query/params for specific dataSource
  //     - If provided, query for that dataSource instance
  //     - If not provided, select default datasource
  // - Update `extensionManager` to have a method to retrieve the default source
  const dataSources = extensionManager.getDataSources(dataSourceName);
  const dataSource = dataSources[0];
  const route = mode.routes[0];

  const { DisplaySetService } = servicesManager.services;

  // Only handling one route per mode for now
  // You can test via http://localhost:3000/example-mode/dicomweb
  const layoutTemplateData = route.layoutTemplate({ location });
  const layoutTemplateModuleEntry = extensionManager.getModuleEntry(
    layoutTemplateData.id
  );
  const LayoutComponent = layoutTemplateModuleEntry.component;

  // For each extension, look up their context modules
  // TODO: move to extension manager.
  let contextModules = [];
  extensions.forEach(extensionId => {
    const allRegisteredModuleIds = Object.keys(extensionManager.modulesMap);
    const moduleIds = allRegisteredModuleIds.filter(id =>
      id.includes(`${extensionId}.contextModule.`)
    );

    if (!moduleIds || !moduleIds.length) {
      return;
    }

    const modules = moduleIds.map(extensionManager.getModuleEntry);
    contextModules = contextModules.concat(modules);
  });

  const contextModuleProviders = contextModules.map(a => a.provider);
  const CombinedContextProvider = ({ children }) =>
    Compose({ components: contextModuleProviders, children });

  function ViewportGridWithDataSource(props) {
    return ViewportGrid({ ...props, dataSource });
  }

  useEffect(() => {
    // TODO -> Make this into a service
    let toolBarManager = new ToolBarManager(extensionManager); //, setToolBarLayout);
    route.init({ toolBarManager });
  }, [mode, dataSourceName, location]);

  const createDisplaySets = useCallback(() => {
    // Add SOPClassHandlers to a new SOPClassManager.
    DisplaySetService.init(extensionManager, sopClassHandlers);

    const queryParams = location.search;

    // Call the data source to start building the view model?
    dataSource.retrieve.series.metadata(
      queryParams,
      DisplaySetService.makeDisplaySets
    );
  }, [location]);

  useEffect(() => {
    createDisplaySets();
  }, [mode, dataSourceName, location]);

  return (
    <CombinedContextProvider>
      {/* TODO: extensionManager is already provided to the extension module.
       *  Use it from there instead of passing as a prop here.
       */}
      <DragAndDropProvider>
        <LayoutComponent
          {...layoutTemplateData.props}
          ViewportGridComp={ViewportGridWithDataSource}
        />
      </DragAndDropProvider>
    </CombinedContextProvider>
  );
}

ModeRoute.propTypes = {
  // Ref: https://reacttraining.com/react-router/web/api/location
  location: PropTypes.shape({
    key: PropTypes.string,
    pathname: PropTypes.string.isRequired,
    search: PropTypes.string.isRequired,
    hash: PropTypes.string.isRequired,
    //state: PropTypes.object.isRequired,
  }),
  mode: PropTypes.object.isRequired,
  dataSourceName: PropTypes.string,
  extensionManager: PropTypes.object,
};
