// Copyright (c) Microsoft Corporation
// All rights reserved.
//
// MIT License
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
// to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
// BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


// module dependencies

require('bootstrap/js/modal.js');
require('datatables.net/js/jquery.dataTables.js');
require('datatables.net-bs/js/dataTables.bootstrap.js');
require('datatables.net-bs/css/dataTables.bootstrap.css');
require('datatables.net-plugins/sorting/natural.js');
require('./job-view.component.scss');
const url = require('url');
// const moment = require('moment/moment.js');
const breadcrumbComponent = require('../breadcrumb/breadcrumb.component.ejs');
const loadingComponent = require('../loading/loading.component.ejs');
const jobViewComponent = require('./job-view.component.ejs');
const jobTableComponent = require('./job-table.component.ejs');
const jobDetailTableComponent = require('./job-detail-table.component.ejs');
const jobDetailConfigInfoModalComponent = require('./job-detail-config-info-modal.component.ejs');
const jobDetailSshInfoModalComponent = require('./job-detail-ssh-info-modal.component.ejs');
const loading = require('../loading/loading.component');
const webportalConfig = require('../../config/webportal.config.js');
const userAuth = require('../../user/user-auth/user-auth.component');

let table = null;
let configInfo = null;
let sshInfo = null;

const jobViewHtml = jobViewComponent({
  breadcrumb: breadcrumbComponent,
  loading: loadingComponent,
  jobTable: jobTableComponent,
});

const getDurationInSeconds = (startTime, endTime) => {
  if (startTime == null) {
    return 0;
  }
  if (endTime == null) {
    endTime = Date.now();
  }
  return Math.round(Math.max(0, endTime - startTime) / 1000);
};

const getHumanizedJobStateString = (jobInfo) => {
  let hjss = '';
  if (jobInfo.state === 'JOB_NOT_FOUND') {
    hjss = 'N/A';
  } else if (jobInfo.state === 'WAITING') {
    if (jobInfo.executionType === 'STOP') {
      hjss = 'Stopping';
    } else {
      hjss = 'Waiting';
    }
  } else if (jobInfo.state === 'RUNNING') {
    if (jobInfo.executionType === 'STOP') {
      hjss = 'Stopping';
    } else {
      hjss = 'Running';
    }
  } else if (jobInfo.state === 'SUCCEEDED') {
    hjss = 'Succeeded';
  } else if (jobInfo.state === 'FAILED') {
    hjss = 'Failed';
  } else if (jobInfo.state === 'STOPPED') {
    hjss = 'Stopped';
  } else {
    hjss = 'Unknown';
  }
  return hjss;
};

const convertTime = (elapsed, startTime, endTime) => {
  if (startTime) {
    if (elapsed) {
      const elapsedTime = getDurationInSeconds(startTime, endTime);
      // TODO: find a better way to humanize elapsedTime.
      // return moment.duration(elapsedTime, "seconds").humanize();
      let result = '';
      const elapsedDay = parseInt(elapsedTime / (24 * 60 * 60));
      if (elapsedDay > 0) {
        result += elapsedDay + 'd ';
      }
      const elapsedHour = parseInt((elapsedTime % (24 * 60 * 60)) / (60 * 60));
      if (result != '' || (result == '' && elapsedHour > 0)) {
        result += elapsedHour + 'h ';
      }
      const elapsedMinute = parseInt(elapsedTime % (60 * 60) / 60);
      if (result != '' || (result == '' && elapsedMinute > 0)) {
        result += elapsedMinute + 'm ';
      }
      const elapsedSecond = parseInt(elapsedTime % 60);
      result += elapsedSecond + 's';
      return result;
    } else {
      const startDate = new Date(startTime);
      return startDate.toLocaleString();
    }
  } else {
    return '--';
  }
};

const convertState = (humanizedJobStateString) => {
  let className = '';
  if (humanizedJobStateString === 'N/A') {
    className = 'label-default';
  } else if (humanizedJobStateString === 'Waiting') {
    className = 'label-warning';
  } else if (humanizedJobStateString === 'Running') {
    className = 'label-primary';
  } else if (humanizedJobStateString === 'Stopping') {
    className = 'label-warning';
  } else if (humanizedJobStateString === 'Succeeded') {
    className = 'label-success';
  } else if (humanizedJobStateString === 'Failed') {
    className = 'label-danger';
  } else if (humanizedJobStateString === 'Stopped') {
    className = 'label-default';
  } else {
    className = 'label-default';
  }
  return `<span class="label ${className}">${humanizedJobStateString}</span>`;
};

const getStateOrder = (jobInfo) => {
  const UNKNOWN = -1;
  const WAITING = 0;
  const RUNNING = 1;
  const STOPPING = 2;
  const STOPPED = 3;
  const SUCCEEDED = 4;
  const FAILED = 5;

  if (jobInfo.state === 'WAITING') {
    return jobInfo.executionType === 'STOP' ? STOPPING : WAITING;
  }
  if (jobInfo.state === 'RUNNING') {
    return jobInfo.executionType === 'STOP' ? STOPPING : RUNNING;
  }
  if (jobInfo.state === 'SUCCEEDED') return SUCCEEDED;
  if (jobInfo.state === 'FAILED') return FAILED;
  if (jobInfo.state === 'STOPPED') return STOPPED;

  return UNKNOWN;
};

const convertGpu = (gpuAttribute) => {
  const bitmap = (+gpuAttribute).toString(2);
  const gpuList = [];
  for (let i = 0; i < bitmap.length; i++) {
    if (bitmap[i] === '1') {
      gpuList.push('#' + (bitmap.length - i - 1).toString());
    }
  }
  if (gpuList.length > 0) {
    gpuList.reverse();
    return gpuList.join(',');
  } else {
    return 'None';
  }
};

const loadJobs = (specifiedVc) => {
  $('#view-table').html(jobTableComponent({}));

  const $table = $('#job-table')
    .on('preXhr.dt', loading.showLoading)
    .on('xhr.dt', loading.hideLoading);

  /* Uncomment following lines for simple profiling:
  $table.on('preXhr.dt', function () {
    console.time('request');
  }).on('xhr.dt', function () {
    console.timeEnd('request');
    console.time('process');
  }).on('preDraw.dt', function () {
    console.timeEnd('process');
    console.time('draw');
  }).on('draw.dt', function () {
    console.timeEnd('draw')
  });
  // */

  table = $table.dataTable({
    'ajax': {
      url: `${webportalConfig.restServerUri}/api/v1/jobs`,
      type: 'GET',
      dataSrc: (data) => {
        if (data.error) {
          alert(data.message);
        } else {
          if (specifiedVc) {
            return data.filter((job) => specifiedVc === (job.virtualCluster || 'default'));
          } else {
            return data;
          }
        }
      },
    },
    'columns': [
      {title: 'Job', data: 'name', render(name, type) {
        if (type !== 'display') return name;
        return '<a href="view.html?jobName=' + name + '">' + name + '</a>';
      }},
      {title: 'User', data: 'username'},
      {title: 'Virtual Cluster', data: 'virtualCluster', render(virtualCluster) {
        let vcName = virtualCluster || 'default';
        return '<a href="virtual-clusters.html?vcName=' + vcName + '">' + vcName + '</a>';
      }},
      {title: 'Start Time', data: 'createdTime', render(createdTime, type) {
        if (type !== 'display') return Math.round(createdTime / 1000);
        return convertTime(false, createdTime);
      }},
      {title: 'Duration', data: null, render({createdTime, completedTime}, type) {
        if (type !== 'display') return getDurationInSeconds(createdTime, completedTime);
        return convertTime(true, createdTime, completedTime);
      }},
      {title: 'Retries', data: 'retries'},
      {title: 'Status', data: null, render(data, type) {
        if (type === 'display') return convertState(getHumanizedJobStateString(data));
        if (type === 'sort') return getStateOrder(data);
        return getHumanizedJobStateString(data);
      }},
      {title: 'Stop', data: null, render(job, type) {
        let hjss = getHumanizedJobStateString(job);
        return (hjss === 'Waiting' || hjss === 'Running') ?
          '<button class="btn btn-default btn-sm" onclick="stopJob(\'' +
            job.name + '\')">Stop</button>':
          '<button class="btn btn-default btn-sm" disabled>Stop</button>';
      }},
    ],
    'scrollY': (($(window).height() - 265)) + 'px',
    'lengthMenu': [[20, 50, 100, -1], [20, 50, 100, 'All']],
    'order': [[3, 'desc']],
    'columnDefs': [
      {type: 'natural', targets: [0, 1, 2, 5, 6]},
      {type: 'num', targets: [3, 4]},
    ],
    'deferRender': true,
    'autoWidth': false,
  }).api();
};

const stopJob = (jobName) => {
  const res = confirm('Are you sure to stop the job?');
  if (res) {
    userAuth.checkToken((token) => {
      $.ajax({
        url: `${webportalConfig.restServerUri}/api/v1/jobs/${jobName}/executionType`,
        type: 'PUT',
        data: {
          value: 'STOP',
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
        success: (data) => {
          window.location.href = 'view.html?jobName=' + jobName;
          loadJobs();
        },
        error: (xhr, textStatus, error) => {
          const res = JSON.parse(xhr.responseText);
          alert(res.message);
        },
      });
    });
  }
};

const loadJobDetail = (jobName) => {
  loading.showLoading();
  configInfo = null;
  sshInfo = null;
  $.ajax({
    url: `${webportalConfig.restServerUri}/api/v1/jobs/${jobName}`,
    type: 'GET',
    success: (data) => {
      loading.hideLoading();
      if (data.error) {
        alert(data.message);
      } else {
        $('#view-table').html(jobDetailTableComponent({
          jobName: data.name,
          jobStatus: data.jobStatus,
          taskRoles: data.taskRoles,
          grafanaUri: webportalConfig.grafanaUri,
          getHumanizedJobStateString,
          convertTime,
          convertState,
          convertGpu,
        }));
        //
        $('a[name=configInfoLink]').addClass('disabled');
        $.ajax({
          url: `${webportalConfig.restServerUri}/api/v1/jobs/${jobName}/config`,
          type: 'GET',
          success: (data) => {
            configInfo = data;
            $('a[name=configInfoLink]').removeClass('disabled');
            $('div[name=configInfoDiv]').attr('title', '');
          },
          error: (xhr, textStatus, error) => {
            const res = JSON.parse(xhr.responseText);
            if (res.message === 'ConfigFileNotFound') {
              $('div[name=configInfoDiv]').attr('title', 'This job\'s config file has not been stored.');
            } else {
              $('div[name=configInfoDiv]').attr('title', 'Error: ' + res.message);
            }
          },
        });
        //
        $('a[name^=sshInfoLink]').addClass('disabled');
        if (data.jobStatus.state !== 'RUNNING') {
          $('div[name^=sshInfoDiv]').attr('title', 'Job is not running.');
        } else {
          $.ajax({
            url: `${webportalConfig.restServerUri}/api/v1/jobs/${jobName}/ssh`,
            type: 'GET',
            success: (data) => {
              sshInfo = data;
              $('a[name^=sshInfoLink]').removeClass('disabled');
              $('div[name^=sshInfoDiv]').attr('title', '');
            },
            error: (xhr, textStatus, error) => {
              const res = JSON.parse(xhr.responseText);
              if (res.message === 'SshInfoNotFound') {
                $('div[name^=sshInfoDiv]').attr('title', 'This job does not contain SSH info.');
              } else {
                $('div[name^=sshInfoDiv]').attr('title', 'Error: ' + res.message);
              }
            },
          });
        }
      }
    },
    error: (xhr, textStatus, error) => {
      const res = JSON.parse(xhr.responseText);
      alert(res.message);
    },
  });
};

const showConfigInfo = (jobName) => {
  $('#modalPlaceHolder').html(jobDetailConfigInfoModalComponent({
    'jobName': jobName,
    'configInfo': configInfo,
  }));
  $('#configInfoModal').modal('show');
};

const showSshInfo = (containerId) => {
  for (let x of sshInfo.containers) {
    if (x.id === containerId) {
      $('#modalPlaceHolder').html(jobDetailSshInfoModalComponent({
        'containerId': containerId,
        'sshIp': x.sshIp,
        'sshPort': x.sshPort,
        'keyPair': sshInfo.keyPair,
      }));
      $('#sshInfoModal').modal('show');
      break;
    }
  }
};

window.loadJobs = loadJobs;
window.stopJob = stopJob;
window.loadJobDetail = loadJobDetail;
window.showConfigInfo = showConfigInfo;
window.showSshInfo = showSshInfo;

const resizeContentWrapper = () => {
  $('#content-wrapper').css({'height': $(window).height() + 'px'});
  if (table != null) {
    $('.dataTables_scrollBody').css('height', (($(window).height() - 265)) + 'px');
    table.columns.adjust().draw();
  }
};

$('#content-wrapper').html(jobViewHtml);

$(document).ready(() => {
  window.onresize = function(envent) {
    resizeContentWrapper();
  };
  resizeContentWrapper();
  $('#sidebar-menu--job-view').addClass('active');
  const query = url.parse(window.location.href, true).query;
  if (query['jobName']) {
    loadJobDetail(query['jobName']);
    $('#content-wrapper').css({'overflow': 'auto'});
  } else {
    loadJobs(query['vcName']);
    $('#content-wrapper').css({'overflow': 'hidden'});
  }
});

module.exports = {loadJobs, stopJob, loadJobDetail};
