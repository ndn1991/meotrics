<?php namespace App\Http\Controllers;

use App\Util\Access;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class PermController extends Controller
{
	public function __construct(Request $request)
	{
		$this->request = $request;
		$this->middleware('auth');
	}

	public function index(Request $request, $appid, $id)
	{
		$userid = \Auth::user()->id;
		$apps = DB::table('apps')->join('user_app', 'apps.id', '=', 'user_app.appid')
				->where('user_app.userid', $userid)
				->where('user_app.can_perm', 1) . get();
		foreach ($apps as $ap) {
			$ap->owner = \App\User::find($ap->ownerid);
			$ap->agencies = DB::table('user_app')->join('users', 'users.id', '=', 'user_app.userid')->where('user_app.appid', $ap->id) . get();
		}

		return view('app/index', [
			'apps' => $apps
		]);
	}

	public function set(Request $request, $appid, $userid)
	{
		$uid = \Auth::user()->id;
		$status = Access::setPerm($uid, $userid, $appid, $request->input('can_perm'), $request->input('can_struct'), $request->input('can_report'));
		if ($status == 0)
			return new Response();
		else abort(403, 'Unauthorized action');
	}

	public function delete(Request $request, $appid, $userid)
	{
		$uid = \Auth::user()->id;
		$status = Access::deletePerm($uid, $userid, $appid);
		if ($status == 0)
			return new Response();
		else abort(403, 'Unauthorized action');
	}

	public function add(Request $request, $appid, $email)
	{
		$uid = \Auth::user()->id;
		//get userid from email
		$userid = DB::table('users')->where('email', $email)->value('id');
		if ($userid == null)
			abort(500, 'cannot find user with email ' . $email);
		$status = Access::setPerm($uid, $userid, $appid, null, null, null);
		if ($status == 0)
			return new Response();
		else abort(403, 'Unauthorized action');
	}

}