﻿/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by APS Partner Development
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////

var itemsTable = null;

const humanReadableTitles = {
    name: 'ITEM NAME',
    createTime: 'CREATION DATE',
    createUserId: 'CREATOR ID',
    createUserName: 'CREATOR NAME',
    lastModifiedTime: 'LAST CHANGE TIME',
    lastModifiedUserId: 'LAST CHANGED BY (ID)',
    lastModifiedUserName: 'LAST CHANGED BY (NAME)',
    fullPath: 'FULL PATH',
    timestamp: 'EXTRACTION DATE'
}

const excludedFromTable = [
    'id',
    'type',
    'hidden'
]

const folderSpecificFields = {
    filesInside: 'FILES INSIDE',
    foldersInside: 'FOLDERS INSIDE'
}

const fileSpecificFields = {
    version: 'VERSION',
    size: 'SIZE'
}

class ItemsTable {
    constructor(tableId, hubId, projectId) {
        this.tableId = tableId;
        this.hubId = hubId;
        this.projectId = projectId;
        this.items = [];
        this.dataSet = [];
        this.fullPaths = {};
        this.guid = createUUID();
        this.requests = 0;
        this.responses = 0;
    }

    getTableData() {
        return $("#itemsTable").bootstrapTable('getData');
    }

    exportData() {
        switch (this.checkExportType()) {
            case 'csv':
                this.exportTableAsCSV();
                break;
        }
    }

    exportTableAsCSV() {
        let csvData = this.getTableData();
        let csvDataCleared = this.cleanForCommas(csvData);
        let csvString = csvDataCleared.join("%0A");
        let a = document.createElement('a');
        a.href = 'data:attachment/csv,' + csvString;
        a.target = '_blank';
        a.download = 'ExportedData' + (new Date()).getTime() + '.csv';
        document.body.appendChild(a);
        a.click();
    }

    getVisibleColumns() {
        let visibleColumnsKeys = [];
        for (const columnObjcet of $("#itemsTable").bootstrapTable('getVisibleColumns')) {
            visibleColumnsKeys.push(columnObjcet.field);
        }
        return visibleColumnsKeys;
    }

    cleanForCommas(csvData) {
        let clearedCsvData = [];
        let visibleColumns = this.getVisibleColumns();
        let mergedTitles = {...humanReadableTitles, ...folderSpecificFields, ...fileSpecificFields};
        clearedCsvData.push(visibleColumns.map((columnName) => mergedTitles[columnName]));
        for (const rowObject of csvData) {
            let auxRow = [];
            for(const columnTitle of visibleColumns){
                auxRow.push(typeof rowObject[columnTitle] === "string" ? rowObject[columnTitle].replaceAll(',', ' ') : rowObject[columnTitle]);
            }
            clearedCsvData.push(auxRow);
        }
        return clearedCsvData;
    }

    checkExportType() {
        return $('input[name=export]:checked', '#datasets').val();
    }

    reset() {
        this.items = [];
        this.dataSet = [];
        this.fullPaths = {};
    }

    checkHumanReadable() {
        return $('input[name=dataTypeToDisplay]:checked', '#datasets').val() === 'humanReadable';
    }

    getTableLevel() {
        return $('input[name=filter_by]:checked', '#statsView').val();
    }

    prepareDataset() {
        let filteredObjects;
        switch (this.getTableLevel()) {
            case "folderlevel":
                filteredObjects = this.items.filter(item => item.type === 'folder');
                break;
            case "filelevel":
                filteredObjects = this.items.filter(item => item.type === 'file');
                break;
        }

        for (const filteredItem of filteredObjects) {
            if (!filteredItem.fullPath) {
                filteredItem.fullPath = this.fullPaths[filteredItem.id];
            }
        }

        this.dataSet = filteredObjects;
    }

    getHumanReadableColumns() {
        let excludedColumns = excludedFromTable;

        this.prepareDataset();
        let tableColumns = [];
        for (const elementKey in humanReadableTitles) {
            if (excludedColumns.findIndex(key => key === elementKey) === -1) {
                tableColumns.push({
                    field: elementKey,
                    title: humanReadableTitles[elementKey]
                })
            }
        }
        switch (this.getTableLevel()) {
            case "folderlevel":
                for (const elementKey in folderSpecificFields) {
                    if (excludedColumns.findIndex(key => key === elementKey) === -1) {
                        tableColumns.push({
                            field: elementKey,
                            title: folderSpecificFields[elementKey]
                        })
                    }
                }
                break;
            case "filelevel":
                for (const elementKey in fileSpecificFields) {
                    if (excludedColumns.findIndex(key => key === elementKey) === -1) {
                        tableColumns.push({
                            field: elementKey,
                            title: fileSpecificFields[elementKey]
                        })
                    }
                }
                break;
        }

        return tableColumns;
    }

    async drawTable() {
        $("#itemsTable").empty();

        this.prepareDataset();
        let tableColumns = this.getHumanReadableColumns();

        $("#itemsTable").bootstrapTable({
            data: this.dataSet,
            pagination: true,
            search: true,
            sortable: true,
            columns: tableColumns
        });
    }

    refreshTable() {
        this.prepareDataset();

        let tableColumns = this.getHumanReadableColumns();

        $('#itemsTable').bootstrapTable('refreshOptions', {
            data: this.dataSet,
            columns: tableColumns
        });
    }

    async fetchDataAsync( currentFolderId = null, dataType ) {
        // this.updateStatus(0,0);
        try {
            const requestUrl = '/api/aps/resource/info';
            const requestData = {
                'hubId': this.hubId,
                'projectId': this.projectId,
                'folderId': currentFolderId,
                'dataType': dataType,
                'connectionId': connection.connection.connectionId,
                'guid': this.guid
            };
            apiClientAsync(requestUrl, requestData);

        }
        catch (err) {
            console.log(err);
        }
    }

    async addItem(dataType, folderData, parentFolderId){
        let jsonFolderData = JSON.parse(folderData);
        this.items.push(jsonFolderData);

        switch (dataType) {
            case 'topFolders': {
                this.fullPaths[jsonFolderData.id] = jsonFolderData.name;
                break;
            }
            case 'folder': {
                let parentFullPath = this.fullPaths[parentFolderId];
                this.fullPaths[jsonFolderData.id] = `${parentFullPath}/${jsonFolderData.name}`;
                let parentFolder = this.items.filter(f => f.id === parentFolderId)[0];
                jsonFolderData.type=='folder'? parentFolder.foldersInside ++ : parentFolder.filesInside ++;
            };
        };
        this.refreshTable();

    }

    async updateStatus(completedJobs, pendingJobs){
        this.responses += completedJobs;
        this.requests += pendingJobs;
        $('#statusLabel').empty();
        $('#statusLabel').append('<label>'+this.responses+' out of '+this.requests+' steps done!</label>');
    }

    async getReport() {
        this.fetchDataAsync(null, 'topFolders');
    }

    async getFolderContents(folder) {
        this.fetchDataAsync(folder.id, 'folder');
    }
}

function createUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
       var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
       return v.toString(16);
    });
}

// helper function for Request
function apiClientAsync(requestUrl, requestData = null, requestMethod = 'get') {
    let def = $.Deferred();

    if (requestMethod == 'post') {
        requestData = JSON.stringify(requestData);
    }

    jQuery.ajax({
        url: requestUrl,
        contentType: 'application/json',
        type: requestMethod,
        dataType: 'json',
        data: requestData,
        success: function (res) {
            def.resolve(res);
        },
        error: function (err) {
            console.error('request failed:');
            def.reject(err)
        }
    });
    return def.promise();
}