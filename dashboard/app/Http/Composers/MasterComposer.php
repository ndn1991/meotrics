<?php namespace App\Http\Composers;

use \App\Util\MtHttp;
use Illuminate\Support\Facades\Cookie;
use Illuminate\View\View;

//App\Http\Composers\View
class MasterComposer
{

	public function compose(View $view)
	{
		$appid = 1;
		$segments = MtHttp::get('segment/' . $appid);

		$view->with('segments', json_encode($segments));

		$view->with('a', 4);
	}

}