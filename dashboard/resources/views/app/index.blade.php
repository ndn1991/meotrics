@extends('../layout/master')

@section('script')

	<script src="{{asset('js/jquery.sparkline.min.js')}}" type="text/javascript"></script>
	<script>
		function confirmDelete(acode) {
			return confirm('Are you sure ? Detele `' + acode + '` action type !');
		}

		onPageLoad(function () {

			function update_status(app) {
				// ok
				var $st = $('.status_' + app);
				$st.empty();

				if (websock.data[app].status == '0') {
					$st.append('<span class="greendot"></span> CONNECTED');
				}

				if (websock.data[app].status == '-1') {
					$st.appendChild('<span class="reddot"></span> DISCONNECTED')
				}
			}

			//websock.change('status', update_status);

			@foreach($apps as $ap)
			//	update_status('{{$ap->code}}');
			@endforeach

		$(".sparkline").sparkline([5, 4, 4, 3, 4, 5, 3, 6, 6, 5, 6, 7, 8, 7], {
				type: 'line',
				lineColor: '#00007f',
				lineWidth: 1,
				spotColor: undefined,
				minSpotColor: undefined,
				maxSpotColor: undefined,
				highlightSpotColor: undefined,
				spotRadius: 0
			});

			$('.id_add').click(function () {
				$.post('/app/create', {name: $('.id_name').val()}, function (appid) {
					showCodeDialog(appid);
				}).fail(function () {
					alert('cannot create app');
				});
				$('.id_name').val("");
			});
		});
	</script>
@endsection

@section('action')
	<button type="button" data-toggle="modal" data-target="#addModal" class="button action blue">
		<span class="label">Track new app</span></button>
@endsection
@section('content')

	<div class="card row">
		<div class="header col-sm-12">
			<h4>Apps manager</h4>
		</div>
		<div class="content col-sm-12">
			<div class="content table-responsive table-full-width col-sm-12">
				<table class="table table-hover table-striped">
					<thead>
					<tr>
						<th>Name</th>
						<th>Traffic</th>
						<th>Status</th>
						<th>Agency</th>
						<th></th>
					</tr>
					</thead>
					<tbody>
					@foreach($apps as $ap)
						<tr>
							<td>{{$ap->name}}
								<br/>
							<code>{{$ap->code}}</code></td>
							<td>43 953 <div class="sparkline"></div></td>

							<td class="status_{{$ap->code}}"><span class="greendot"></span> CONNECTED</td>
							<td>
								@foreach($ap->agencies as $ag)
									{{$ag->name}}  <span
													class="text-muted"> {{$ag->email}}</span> {!!   $ag->can_perm == 1 ? '<i class="fa fa-star orange"></i>' : ($ag->can_struct == 1 ? '<i class="fa fa-star gray"></i>': '' )!!}
									<br/>
								@endforeach
							</td>
							<td class="row">
								<a class="button action" href="/dashboard/{{$ap->code}}"> Enter Dashboard</a>
								<a class="button action" href="/app/edit/{{$ap->code}}"><i class="fa fa-edit"></i></a>
							</td>
						</tr>
					@endforeach
					</tbody>
				</table>
			</div>
		</div>

	</div>

	<div class="hidden">

	</div>
@endsection

@section('additional')
	<div class="modal fade" id="addModal" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
		<div class="modal-dialog" role="document">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span
										aria-hidden="true">&times;</span></button>
					<h4 class="modal-title" id="myModalLabel">Track new app</h4>
				</div>
				<div class="modal-body">
					<div class="row pt pb10">
						<div class="col-sm-4 ">
							<h6 class="pull-right">name of the app</h6>
						</div>
						<div class="col-sm-7">
							<input type="text" class="form-control id_name" placeholder="App Name" required>
						</div>
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" data-dismiss="modal" class="button action ">
						<span class="label">Cancel</span></button>
					<button type="button" data-dismiss="modal" class="button action blue id_add">
						<span class="label">Next step</span></button>

				</div>
			</div>
		</div>
	</div>
@endsection